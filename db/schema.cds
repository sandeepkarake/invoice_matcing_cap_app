namespace ap.matching;

using { cuid, managed, Currency } from '@sap/cds/common';

type InvoiceStatus : String enum {
  open;
  matched;
  escalated;
}

entity Invoices : cuid, managed {
  supplier    : String(100) @mandatory;
  amount      : Decimal(15,2) @mandatory;
  currency    : Currency;
  description : String(255);
  status      : InvoiceStatus default 'open';
  matchedPO   : Association to PurchaseOrders;
  decisions   : Association to many MatchDecisions on decisions.invoice = $self;
  embedding   : Vector = vector_embedding(description, 'DOCUMENT', 'SAP_GXY.20250407') stored;
}

entity PurchaseOrders : cuid, managed {
  supplier        : String(100) @mandatory;
  lineItem        : String(255) @mandatory;
  amount          : Decimal(15,2) @mandatory;
  currency        : Currency;
  isOpen          : Boolean default true;
  decisions       : Association to many MatchDecisions on decisions.purchaseOrder = $self;
  embedding       : Vector = vector_embedding(lineItem, 'DOCUMENT', 'SAP_GXY.20250407') stored;
}

type DecisionOutcome : String enum {
  proposed;
  approved;
  rejected;
  escalated;
}

entity MatchDecisions : cuid, managed {
  invoice       : Association to Invoices @mandatory;
  purchaseOrder : Association to PurchaseOrders @mandatory;
  confidence    : Decimal(3,2); // 0.00 - 1.00
  rationale     : String(1000);
  outcome       : DecisionOutcome default 'proposed';
  decidedBy     : String(120);
  decidedAt     : Timestamp;
}

annotate MatchDecisions {
  outcome    @changelog;
  confidence @changelog;
  rationale  @changelog;
}
