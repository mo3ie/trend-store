import UtilityService from "@/components/UtilityService";

export const metadata = { title: "خالص — شحن عداد الكهرباء | محل ترند" };

export default function ElectricityPage() {
  return <UtilityService mode="meter" />;
}
