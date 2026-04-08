import Navbar from "@/components/public/Navbar";
import HeroSlider from "@/components/public/HeroSlider";
import BrandIntro from "@/components/public/BrandIntro";
import NewsSection from "@/components/public/NewsSection";
import ServiceIconGrid from "@/components/public/ServiceIconGrid";
import ServiceDetail from "@/components/public/ServiceDetail";
import AppSection from "@/components/public/AppSection";
import Footer from "@/components/public/Footer";

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <HeroSlider />
      <BrandIntro />
      <NewsSection />
      <ServiceIconGrid />
      <ServiceDetail
        number={1}
        title="Laundry Booking"
        description="Book your laundry anytime, anywhere. Choose your preferred branch, select your service, pick a schedule, and confirm — all from your phone."
        icons={["washer", "dryer", "detergent", "phone", "calendar", "notification", "wifi", "basket"]}
        images={[
          "https://picsum.photos/seed/wash10/800/600",
          "https://picsum.photos/seed/fold11/800/600",
          "https://picsum.photos/seed/iron12/800/600",
          "https://picsum.photos/seed/clean13/800/600",
        ]}
        bgColor="gray"
      />
      <ServiceDetail
        number={2}
        title="Order Tracking"
        description="Track every step of your laundry order in real time. From received to washing, drying, and ready for pickup — always know where your clothes are."
        icons={["tracking", "notification", "phone", "checkmark"]}
        images={[
          "https://picsum.photos/seed/track14/800/600",
          "https://picsum.photos/seed/status15/800/600",
          "https://picsum.photos/seed/monitor16/800/600",
          "https://picsum.photos/seed/update17/800/600",
        ]}
        bgColor="light-gray"
      />
      <ServiceDetail
        number={3}
        title="Live Delivery"
        description="Watch your laundry come to you on a live map. GPS-enabled delivery tracking shows exactly where your rider is with accurate arrival times."
        icons={["map", "delivery", "gps", "timer"]}
        images={[
          "https://picsum.photos/seed/deliver18/800/600",
          "https://picsum.photos/seed/route19/800/600",
          "https://picsum.photos/seed/package20/800/600",
          "https://picsum.photos/seed/arrive21/800/600",
        ]}
        bgColor="gray"
      />
      <ServiceDetail
        number={4}
        title="Digital Payment"
        description="Go cashless with secure GCash payment integration powered by PayMongo. Pay for your laundry services instantly and securely right from the app."
        icons={["payment", "gcash", "secure", "receipt"]}
        images={[
          "https://picsum.photos/seed/pay22/800/600",
          "https://picsum.photos/seed/cashless23/800/600",
          "https://picsum.photos/seed/wallet24/800/600",
          "https://picsum.photos/seed/transaction25/800/600",
        ]}
        bgColor="light-gray"
      />
      <AppSection />
      <Footer />
    </div>
  );
}
