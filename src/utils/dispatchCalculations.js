/**
 * Dispatch Calculations and Default Data State
 * Provides data modeling and formula recalculation for dispatch entries.
 */

export const DEFAULT_DISPATCH_DATA = {
  dispatchNo: "",
  status: "Draft", // Draft, Ready for Dispatch, In Transit, Delivered, Cancelled
  shippingDate: new Date().toISOString().split("T")[0],
  waybillNo: "",
  vatNo: "",
  reasonForExport: "Samples, as per customer request.",
  
  // Sender Details
  sender: {
    name: "Manura Mohotti",
    designation: "Manura Mohotti-Manager Marketing",
    address: "Toyo Cushion Lanka Pvt Ltd.No.25 Foster Lane, Colombo 10,",
    contact: "+9474 216 8231",
    email: "Manura.Mohotti@hayleysfibre.com",
    country: "Sri Lanka",
    signatureText: "Manura Mohotti",
    signatureBase64: "",
    signatureUrl: "",
    companyName: "Toyo Cushion Lanka Pvt Ltd",
    companyAddress: "No.25 Foster Lane, Colombo 10, Sri Lanka",
    originCity: "COLOMBO, SRI LANKA",
    meansOfConveyance: "BY COURIER FROM COLOMBO, SRI LANKA"
  },

  // Receiver / Consignee Details
  receiver: {
    name: "Leonard Saranga",
    address: "Adress \nLgh 1001,\nThomsons våg 30B, \nMalmö\nZip 21372\nSweden",
    contact: "+46 76 439 46 86",
    email: "leo@nordiceasysolutions.com",
    country: "Sweden",
    currency: "USD",
    portOfEntry: ""
  },

  // Logistics & Wharf Details
  logistics: {
    courierCharges: 0,
    noOfBoxes: 2,
    intendedUse: "As samples",
    airwayBillNo: "",
    pqRegNo: "",
    invoiceNo: "",
    pscNo: "",
    wharfClerkName: "",
    wharfClerkId: "",
    wharfClerkContact: "",
    wharfClerkChaReg: "",
    directorCustomsNote: "BIA, Katunayake"
  },

  // Sample Items
  items: [
    {
      id: "item-1",
      description: "Needeled sheet 290 × 500 mm x10 mm",
      commonName: "Needeled sheet 290 × 500 mm x10 mm",
      botanicalName: "Cocos nucifera",
      qty: 25,
      unit: "pcs",
      weightKg: 1,
      unitPrice: 0.1,
      boxNo: "Box 1"
    },
    {
      id: "item-2",
      description: "Needeled sheet 370 × 270 mm Standard 10mm",
      commonName: "Needeled sheet 370 × 270 mm Standard 10mm",
      botanicalName: "Cocos nucifera",
      qty: 25,
      unit: "pcs",
      weightKg: 1,
      unitPrice: 0.1,
      boxNo: "Box 1"
    },
    {
      id: "item-3",
      description: "Needeled sheet 500 x235 mm Standard 10mm",
      commonName: "Needeled sheet 500 x235 mm Standard 10mm",
      botanicalName: "Cocos nucifera",
      qty: 100,
      unit: "pcs",
      weightKg: 2,
      unitPrice: 0.1,
      boxNo: "Box 1"
    },
    {
      id: "item-4",
      description: "Needeled sheet 508 x254 mm Standard 10mm",
      commonName: "Needeled sheet 508 x254 mm Standard 10mm",
      botanicalName: "Cocos nucifera",
      qty: 50,
      unit: "pcs",
      weightKg: 2,
      unitPrice: 0.1,
      boxNo: "Box 2"
    },
    {
      id: "item-5",
      description: "Needeled sheet 180 x 180mm Standard 10mm",
      commonName: "Needeled sheet 180 x 180mm Standard 10mm",
      botanicalName: "Cocos nucifera",
      qty: 15,
      unit: "pcs",
      weightKg: 2,
      unitPrice: 0.1,
      boxNo: "Box 2"
    },
    {
      id: "item-6",
      description: "Needeled sheet 230 x 480 mm Standard 30mm",
      commonName: "Needeled sheet 230 x 480 mm Standard 30mm",
      botanicalName: "Cocos nucifera",
      qty: 15,
      unit: "pcs",
      weightKg: 2,
      unitPrice: 0.1,
      boxNo: "Box 2"
    },
    {
      id: "item-7",
      description: "285 x 588 mm Standard 30mm",
      commonName: "285 x 588 mm Standard 30mm",
      botanicalName: "Cocos nucifera",
      qty: 15,
      unit: "pcs",
      weightKg: 2,
      unitPrice: 0.1,
      boxNo: "Box 2"
    }
  ]
};

/**
 * Calculates derived totals and values
 */
export function calculateDispatchTotals(dispatchData) {
  const items = dispatchData?.items || [];
  
  let totalQty = 0;
  let totalNetWeight = 0;
  let cargoValue = 0;

  const computedItems = items.map(item => {
    const qty = Number(item.qty) || 0;
    const weight = Number(item.weightKg) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    const lineTotal = +(qty * unitPrice).toFixed(2);
    
    totalQty += qty;
    totalNetWeight += weight;
    cargoValue += lineTotal;

    return {
      ...item,
      qty,
      weightKg: weight,
      unitPrice,
      lineTotal
    };
  });

  totalNetWeight = +totalNetWeight.toFixed(2);
  cargoValue = +cargoValue.toFixed(2);

  // Total Gross weight = Total Net Weight + packaging allowance (default 1kg)
  const totalGrossWeight = +(totalNetWeight + 1).toFixed(2);
  const courierCharges = Number(dispatchData?.logistics?.courierCharges) || 0;
  const totalInvoiceValue = +(cargoValue + courierCharges).toFixed(2);
  const noOfBoxes = Number(dispatchData?.logistics?.noOfBoxes) || 1;

  return {
    computedItems,
    totalQty,
    totalNetWeight,
    totalGrossWeight,
    cargoValue,
    courierCharges,
    totalInvoiceValue,
    noOfBoxes
  };
}
