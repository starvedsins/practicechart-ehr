import PatientRegistration from "@/components/patient-registration";
export const dynamic = "force-dynamic";
export default function RegistrationPage() {
  return <PatientRegistration demo={process.env.DEMO_MODE === "true"} />;
}
