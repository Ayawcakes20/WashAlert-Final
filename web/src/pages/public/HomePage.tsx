import Navbar from "@/components/public/Navbar";
import HeroSlider from "@/components/public/HeroSlider";
import BrandIntro from "@/components/public/BrandIntro";
import NewsSection from "@/components/public/NewsSection";
import ServiceIconGrid from "@/components/public/ServiceIconGrid";
import ServiceDetail from "@/components/public/ServiceDetail";
import AppSection from "@/components/public/AppSection";
import Footer from "@/components/public/Footer";
import svcBooking from "@/assets/svc-booking.png";
import svcTracking from "@/assets/svc-tracking.png";
import svcDelivery from "@/assets/svc-delivery.png";
import svcPayment from "@/assets/svc-payment.png";
import heroMachines from "@/assets/hero-machines.png";
import heroLinens from "@/assets/hero-linens.png";
import heroDetergent from "@/assets/hero-detergent.png";
import heroBasket from "@/assets/hero-basket.png";
import heroDryer from "@/assets/hero-dryer.png";

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
        images={[svcBooking, heroMachines, heroBasket, heroDetergent]}
        bgColor="gray"
      />
      <ServiceDetail
        number={2}
        title="Order Tracking"
        description="Track every step of your laundry order in real time. From received to washing, drying, and ready for pickup — always know where your clothes are."
        icons={["tracking", "notification", "phone", "checkmark"]}
        images={[svcTracking, heroDryer, heroLinens, heroMachines]}
        bgColor="light-gray"
      />
      <ServiceDetail
        number={3}
        title="Live Delivery"
        description="Watch your laundry come to you on a live map. GPS-enabled delivery tracking shows exactly where your rider is with accurate arrival times."
        icons={["map", "delivery", "gps", "timer"]}
        images={[svcDelivery, heroBasket, heroLinens, heroDetergent]}
        bgColor="gray"
      />
      <ServiceDetail
        number={4}
        title="Digital Payment"
        description="Go cashless with secure GCash payment integration powered by PayMongo. Pay for your laundry services instantly and securely right from the app."
        icons={["payment", "gcash", "secure", "receipt"]}
        images={[svcPayment, svcBooking, heroMachines, heroDetergent]}
        bgColor="light-gray"
      />
      <AppSection />
      <Footer />
    </div>
  );
}
