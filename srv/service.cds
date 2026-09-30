using ap.matching as db from '../db/schema';
using { sap.s4com.Supplier.v1 as s4 } from 'sap-s4com-supplier-v1';

@odata @mcp @agent
service MatchingService {

  entity Invoices as projection on db.Invoices {
    *,
    supplierInfo : Association to SupplierInfo on supplierInfo.name = supplier,
    dataSubject  : Association to s4.Supplier on dataSubject.SupplierName = supplier
  };

  entity PurchaseOrders as projection on db.PurchaseOrders;

  @readonly
  entity SupplierInfo as projection on s4.SupplierCompanyCode {
    key _Supplier.SupplierName      as name,
        PaymentTerms                as paymentTerms,
        SupplierIsBlockedForPosting as blockedForPosting,
        PaymentBlockingReason       as paymentBlockingReason
  };

  entity MatchDecisions as projection on db.MatchDecisions actions {
    action approveMatch()  returns MatchDecisions;
    action rejectMatch()   returns MatchDecisions;
    action escalateMatch() returns MatchDecisions;
  };

  // Unbound counterparts of the actions above, so MCP's `call` tool can
  // reach them (bound entity actions aren't exposed as MCP tools).
  @agent.hitl // the agent must get human sign-off before approving a match
  action approveMatchDecision(decision : UUID)  returns MatchDecisions;
  action rejectMatchDecision(decision : UUID)   returns MatchDecisions;
  action escalateMatchDecision(decision : UUID) returns MatchDecisions;

  /** Record a new match between an invoice and an open purchase order, in 'proposed' state. */
  action proposeMatch(
    invoice       : UUID           @mandatory,
    purchaseOrder : UUID           @mandatory,
    confidence    : Decimal(3, 2)  @mandatory @assert.range: [0, 1],
    rationale     : String(1000)   @mandatory
  ) returns MatchDecisions;

  // Semantic search results carry the cosine similarity (-1..1, higher = closer) to the query.
  type InvoiceSearchResult {
    ID            : UUID;
    supplier      : String(100);
    amount        : Decimal(15,2);
    currency_code : String(3);
    description   : String(255);
    status        : String;
    matchedPO_ID  : UUID;
    similarity    : Double;
  }

  type PurchaseOrderSearchResult {
    ID            : UUID;
    supplier      : String(100);
    lineItem      : String(255);
    amount        : Decimal(15,2);
    currency_code : String(3);
    isOpen        : Boolean;
    similarity    : Double;
  }

  function searchInvoices(query : String)       returns many InvoiceSearchResult;
  function searchPurchaseOrders(query : String) returns many PurchaseOrderSearchResult;
}

annotate MatchingService.Invoices with @PersonalData: {
  EntitySemantics: 'Other'
} {
  dataSubject @PersonalData.FieldSemantics: 'DataSubjectID';
  supplier    @PersonalData.IsPotentiallyPersonal;
  description @PersonalData.IsPotentiallyPersonal;
};

annotate s4.Supplier with @PersonalData: {
  EntitySemantics: 'DataSubject',
  DataSubjectRole: 'Supplier'
} {
  Supplier     @PersonalData.FieldSemantics: 'DataSubjectID';
  SupplierName @PersonalData.IsPotentiallyPersonal;
};
