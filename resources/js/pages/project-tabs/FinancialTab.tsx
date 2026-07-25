import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { FinancialModule, FinancialField } from "@/components/FinancialModule";

type ModuleKind = "budget" | "revenue" | "expenses" | "payments";

export function FinancialTab({
  projectId,
  kind,
}: {
  projectId: string;
  kind: ModuleKind;
}) {
  // Always call hooks at the top level unconditionally (React Rules of Hooks)
  const { data: shareholders } = useQuery({
    queryKey: ["shareholders-for-payments", projectId],
    queryFn: async () => {
      try {
        const res = await api.get(`/shareholders?project_id=${projectId}`);
        return res.data;
      } catch {
        return [];
      }
    },
  });

  if (kind === "budget") {
    const fields: FinancialField[] = [
      {
        key: "category",
        label: "Category",
        type: "select",
        required: true,
        allowCustom: true,
        placeholder: "-- Select Budget Category --",
        options: [
          { value: "Foundation & Civil Structure", label: "Foundation & Civil Structure" },
          { value: "Superstructure & Brickwork", label: "Superstructure & Brickwork" },
          { value: "Electrical & Plumbing (MEP)", label: "Electrical & Plumbing (MEP)" },
          { value: "Finishing & Architecture", label: "Finishing & Architecture" },
          { value: "Land & Legal Documentation", label: "Land & Legal Documentation" },
          { value: "Contingencies & Reserves", label: "Contingencies & Reserves" },
        ],
      },
      { key: "date", label: "Date", type: "date", required: true },
      { key: "amount", label: "Amount (BDT)", type: "number", required: true, placeholder: "0.00" },
      { key: "description", label: "Description", type: "textarea", placeholder: "Budget details..." },
    ];
    return (
      <FinancialModule
        projectId={projectId}
        table="budgets"
        title="Project Budget"
        singular="Budget item"
        fields={fields}
      />
    );
  }

  if (kind === "revenue") {
    const fields: FinancialField[] = [
      {
        key: "source",
        label: "Revenue Source",
        type: "select",
        required: true,
        allowCustom: true,
        placeholder: "-- Select Revenue Source --",
        options: [
          { value: "Unit Pre-sale", label: "Unit Pre-sale" },
          { value: "Apartment Booking", label: "Apartment Booking" },
          { value: "Commercial Shop Rent", label: "Commercial Shop Rent" },
          { value: "Car Parking Slot", label: "Car Parking Slot" },
          { value: "Service Charge", label: "Service Charge" },
          { value: "Utility Deposit", label: "Utility Deposit" },
          { value: "Other Revenue", label: "Other Revenue" },
        ],
      },
      { key: "reference_no", label: "Invoice / Reference No", placeholder: "Auto-generated invoice number..." },
      { key: "date", label: "Date", type: "date", required: true },
      { key: "amount", label: "Amount (BDT)", type: "number", required: true, placeholder: "0.00" },
      { key: "description", label: "Description", type: "textarea", placeholder: "Revenue notes..." },
    ];
    return (
      <FinancialModule
        projectId={projectId}
        table="revenues"
        title="Project Revenue"
        singular="Revenue entry"
        fields={fields}
      />
    );
  }

  if (kind === "expenses") {
    const fields: FinancialField[] = [
      {
        key: "category",
        label: "Expense Category",
        type: "select",
        required: true,
        allowCustom: true,
        placeholder: "-- Select Expense Category --",
        options: [
          { value: "Civil Structure & Concrete", label: "Civil Structure & Concrete" },
          { value: "Electrical Supplies", label: "Electrical Supplies" },
          { value: "Plumbing & Sanitation", label: "Plumbing & Sanitation" },
          { value: "Raw Materials & Cement", label: "Raw Materials & Cement" },
          { value: "Labor & Subcontractor", label: "Labor & Subcontractor" },
          { value: "Site Equipment & Fuel", label: "Site Equipment & Fuel" },
          { value: "Legal & Licensing", label: "Legal & Licensing" },
          { value: "Office & Admin Expense", label: "Office & Admin Expense" },
        ],
      },
      { key: "paid_to", label: "Paid To", placeholder: "Vendor / Supplier name" },
      { key: "reference_no", label: "Voucher / Reference No", placeholder: "Auto-generated voucher number..." },
      { key: "date", label: "Date", type: "date", required: true },
      { key: "amount", label: "Amount (BDT)", type: "number", required: true, placeholder: "0.00" },
      { key: "description", label: "Description", type: "textarea", placeholder: "Expense justification..." },
    ];
    return (
      <FinancialModule
        projectId={projectId}
        table="expenses"
        title="Project Expenses"
        singular="Expense entry"
        fields={fields}
      />
    );
  }

  // Owner Payments
  const shareholderOptions = (shareholders ?? []).map((s: any) => {
    const sharesInfo = s.effective_share_count || s.share_count
      ? ` (${s.effective_share_count || s.share_count} Shares)`
      : ` (${s.ownership_pct ?? 0}%)`;
    return {
      value: s.name,
      label: `${s.name}${sharesInfo}`,
    };
  });

  const paymentFields: FinancialField[] = [
    {
      key: "paid_to",
      label: "Paid To (Select Shareholder / Owner)",
      type: "select",
      required: true,
      placeholder: "-- Select Shareholder / Partner --",
      options: shareholderOptions.length > 0 ? shareholderOptions : [
        { value: "Owner", label: "Project Owner / Partner" }
      ],
    },
    {
      key: "payment_method",
      label: "Payment Method",
      type: "select",
      placeholder: "-- Select Payment Method --",
      options: [
        { value: "Bank Transfer", label: "Bank Transfer / Wire" },
        { value: "Cheque", label: "Cheque / Pay Order" },
        { value: "Cash", label: "Cash" },
        { value: "Mobile Banking", label: "Mobile Banking (bKash / Nagad)" },
        { value: "Other", label: "Other Method" },
      ],
    },
    { key: "date", label: "Date", type: "date", required: true },
    { key: "amount", label: "Amount (BDT)", type: "number", required: true, placeholder: "0.00" },
    { key: "description", label: "Description / Notes", type: "textarea", placeholder: "Payment justification or notes..." },
  ];

  return (
    <FinancialModule
      projectId={projectId}
      table="owner_payments"
      title="Owner Payments"
      singular="Owner Payment"
      fields={paymentFields}
    />
  );
}
