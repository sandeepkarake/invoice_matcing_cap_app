import cds from '@sap/cds';

// Valid decision workflow transitions.
// proposed -> approved | rejected | escalated
// approved -> escalated (only)
// rejected, escalated are final.
const ALLOWED_TRANSITIONS = {
  proposed: ['approved', 'rejected', 'escalated'],
  approved: ['escalated'],
  rejected: [],
  escalated: [],
};

function assertTransition(current, next, req) {
  const allowed = ALLOWED_TRANSITIONS[current] || [];
  if (!allowed.includes(next)) {
    req.error(409, `Cannot move a match decision from '${current}' to '${next}'.`);
    return false;
  }
  return true;
}

export default class MatchingService extends cds.ApplicationService {
  async init() {
    const { Invoices, PurchaseOrders, MatchDecisions } = this.entities;

    // Dev-only: let the agent use Gemini when GOOGLE_API_KEY and GEMINI_MODEL are set.
    // Anything else falls through to @cap-js/agents' own model selection (AI Core, Anthropic or mock).
    const { GOOGLE_API_KEY, GEMINI_MODEL } = process.env;
    if (GOOGLE_API_KEY && GEMINI_MODEL && cds.env.profiles.includes('development')) {
      cds.log('agents').info(`using Gemini model '${GEMINI_MODEL}' for the agent`);
      this.on('buildModel', async () => {
        const { default: GeminiChatModel } = await import('./gemini-model.js');
        return new GeminiChatModel({ apiKey: GOOGLE_API_KEY, model: GEMINI_MODEL, temperature: 0 });
      });
    }

    // --- Recording a match: plain POST to MatchDecisions ---
    this.on('CREATE', MatchDecisions, async (req, next) => {
      const { invoice_ID, purchaseOrder_ID } = req.data;
      if (!invoice_ID || !purchaseOrder_ID) {
        return req.error(400, 'invoice and purchaseOrder are required.');
      }
      const invoice = await SELECT.one.from(Invoices).where({ ID: invoice_ID });
      if (!invoice) return req.error(404, 'Invoice not found.');

      const po = await SELECT.one.from(PurchaseOrders).where({ ID: purchaseOrder_ID });
      if (!po) return req.error(404, 'Purchase order not found.');
      if (!po.isOpen) return req.error(409, 'Purchase order is not open.');

      req.data.outcome = 'proposed';
      req.data.decidedBy = req.user?.id || 'unknown';
      req.data.decidedAt = new Date().toISOString();

      const result = await next();

      await UPDATE(Invoices, invoice_ID).with({ status: 'matched', matchedPO_ID: purchaseOrder_ID });
      await UPDATE(PurchaseOrders, purchaseOrder_ID).with({ isOpen: false });

      return result;
    });

    // --- MatchDecisions.approve / reject / escalate ---
    const applyTransition = async (decisionId, outcome, req) => {
      const decision = await SELECT.one.from(MatchDecisions).where({ ID: decisionId });
      if (!decision) return req.error(404, 'Match decision not found.');

      if (!assertTransition(decision.outcome, outcome, req)) return;

      const user = req.user?.id || 'unknown';
      await UPDATE(MatchDecisions, decisionId).with({
        outcome,
        decidedBy: user,
        decidedAt: new Date().toISOString(),
      });

      // Reflect the outcome on the linked invoice / PO
      const invoiceId = decision.invoice_ID;
      const poId = decision.purchaseOrder_ID;

      if (outcome === 'approved') {
        await UPDATE(Invoices, invoiceId).with({ status: 'matched', matchedPO_ID: poId });
        await UPDATE(PurchaseOrders, poId).with({ isOpen: false });
      } else if (outcome === 'rejected') {
        await UPDATE(Invoices, invoiceId).with({ status: 'open', matchedPO_ID: null });
        await UPDATE(PurchaseOrders, poId).with({ isOpen: true });
      } else if (outcome === 'escalated') {
        await UPDATE(Invoices, invoiceId).with({ status: 'escalated' });
      }

      return SELECT.one.from(MatchDecisions).where({ ID: decisionId });
    };

    // Bound actions (used by the OData UI: /MatchDecisions(ID)/MatchingService.approveMatch)
    const handleTransition = (outcome) => async (req) => {
      const decisionId = req.params[0].ID ?? req.params[0];
      return applyTransition(decisionId, outcome, req);
    };
    this.on('approveMatch', MatchDecisions, handleTransition('approved'));
    this.on('rejectMatch', MatchDecisions, handleTransition('rejected'));
    this.on('escalateMatch', MatchDecisions, handleTransition('escalated'));

    // Unbound counterparts (used by MCP: bound entity actions aren't exposed as MCP tools)
    this.on('approveMatchDecision', async (req) => applyTransition(req.data.decision, 'approved', req));
    this.on('rejectMatchDecision', async (req) => applyTransition(req.data.decision, 'rejected', req));
    this.on('escalateMatchDecision', async (req) => applyTransition(req.data.decision, 'escalated', req));

    // Goes through this service's CREATE handler above, so validation and side effects are shared with the UI.
    this.on('proposeMatch', async (req) => {
      const { invoice, purchaseOrder, confidence, rationale } = req.data;
      const ID = cds.utils.uuid();
      await this.run(INSERT.into(MatchDecisions).entries({
        ID, invoice_ID: invoice, purchaseOrder_ID: purchaseOrder, confidence, rationale,
      }));
      return SELECT.one.from(MatchDecisions).where({ ID });
    });

    // Semantic search: rank by cosine similarity between the stored embedding and the embedded query.
    // Same CQL runs on SQLite (local ONNX model via @cap-js/ai) and on SAP HANA (native vector engine).
    // The score is returned as `similarity` so callers can judge how relevant each hit is.
    const semanticSearch = (entity, columns) => ({ data: { query } }) =>
      SELECT.from(entity)
        .columns(...columns)
        .columns`cosine_similarity(embedding, vector_embedding(${query}, 'QUERY', 'SAP_GXY.20250407')) as similarity`
        .orderBy`similarity desc`
        .limit(5);
    this.on('searchInvoices', semanticSearch(Invoices,
      ['ID', 'supplier', 'amount', 'currency_code', 'description', 'status', 'matchedPO_ID']));
    this.on('searchPurchaseOrders', semanticSearch(PurchaseOrders,
      ['ID', 'supplier', 'lineItem', 'amount', 'currency_code', 'isOpen']));

    return super.init();
  }
}
