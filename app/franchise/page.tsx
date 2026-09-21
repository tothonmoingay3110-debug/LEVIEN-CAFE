import { Footer } from "@/components/Footer";
import { FranchiseForm } from "@/components/FranchiseForm";
import { Header } from "@/components/Header";

export default function FranchisePage() {
  return <><Header /><main className="franchisePage"><section className="franchiseIntro"><span className="sectionLabel">Grow with LEVIEN</span><h1>Bring Vietnamese flavor to your community.</h1><p>Tell us where and how you would like to open a LEVIEN location. Our team will review your inquiry and contact you to discuss the next steps.</p><div><strong>Flexible formats</strong><span>Café, takeaway, food truck, kiosk and more.</span></div><div><strong>Focused menu</strong><span>Bánh mì, Vietnamese coffee, or both.</span></div></section><FranchiseForm /></main><Footer /></>;
}
