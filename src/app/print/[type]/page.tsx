import PrintDocument from "@/components/print-document";
export default async function PrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ id?: string }>;
}) {
  return (
    <PrintDocument
      type={(await params).type}
      id={(await searchParams).id || ""}
    />
  );
}
