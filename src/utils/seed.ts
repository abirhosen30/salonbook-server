import { getServicesCollection } from "../config/database.js";
import { ServiceDocument } from "../types/index.js";

const initialServices: Omit<ServiceDocument, "_id">[] = [
  {
    serviceName: "Luxe Balayage & Glossing",
    category: "Hair Coloring",
    description: "Multi-dimensional sun-kissed custom hand-painted color and conditioning gloss for effortless radiance.",
    price: 185,
    duration: 120,
    image: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&auto=format&fit=crop&q=80",
    status: "active",
    createdAt: "2026-01-10T10:00:00.000Z",
  },
  {
    serviceName: "Signature Botanical Hair & Scalp Ritual",
    category: "Hair Treatment",
    description: "Deep steam therapy with organic rosemary and keratin infusion for restorative shine and root health.",
    price: 95,
    duration: 60,
    image: "https://images.unsplash.com/photo-1562322140-8baeececf3df?w=800&auto=format&fit=crop&q=80",
    status: "active",
    createdAt: "2026-01-12T10:00:00.000Z",
  },
  {
    serviceName: "Precision Master Cut & Blowout",
    category: "Haircut & Styling",
    description: "Bespoke sculptural dry cut tailored to your facial architecture and natural hair movement, finished with our signature blowout.",
    price: 75,
    duration: 45,
    image: "https://images.unsplash.com/photo-1580618672591-eb180b1a973f?w=800&auto=format&fit=crop&q=80",
    status: "active",
    createdAt: "2026-01-14T10:00:00.000Z",
  },
  {
    serviceName: "Hydra-Luxe Radiance Facial",
    category: "Facial & Skincare",
    description: "Deep sonic pore extraction, peptide infusion and cold cryogenic lifting massage for luminous, poreless skin.",
    price: 130,
    duration: 75,
    image: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=800&auto=format&fit=crop&q=80",
    status: "active",
    createdAt: "2026-01-15T10:00:00.000Z",
  },
  {
    serviceName: "Velvet Couture Gel & Pedicure",
    category: "Manicure & Pedicure",
    description: "Botanical soak, gentle cuticle revival, exfoliating brown sugar scrub, and long-wear biocompatible gel finish.",
    price: 85,
    duration: 90,
    image: "https://images.unsplash.com/photo-1632345031435-8727f6897d53?w=800&auto=format&fit=crop&q=80",
    status: "active",
    createdAt: "2026-01-18T10:00:00.000Z",
  },
  {
    serviceName: "Aromatherapy Hot Stone Relief",
    category: "Spa & Massage",
    description: "Warm basalt stones and organic lavender-eucalyptus oil melting neck, shoulder and back tension effortlessly.",
    price: 120,
    duration: 60,
    image: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&auto=format&fit=crop&q=80",
    status: "active",
    createdAt: "2026-01-20T10:00:00.000Z",
  },
  {
    serviceName: "Bridal Glamour & Airbrush Makeup",
    category: "Makeup",
    description: "Sweat-proof, HD-camera ready airbrushed complexion design including lash styling and evening glamour.",
    price: 150,
    duration: 90,
    image: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=800&auto=format&fit=crop&q=80",
    status: "active",
    createdAt: "2026-01-22T10:00:00.000Z",
  },
  {
    serviceName: "Japanese Hair Smoothing Restructure",
    category: "Hair Treatment",
    description: "Long-lasting silk restructuring protocol that seals the cuticle and eliminates humidity frizz.",
    price: 220,
    duration: 150,
    image: "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=800&auto=format&fit=crop&q=80",
    status: "inactive",
    createdAt: "2026-01-25T10:00:00.000Z",
  },
];

export async function seedInitialServicesIfNeeded(): Promise<void> {
  try {
    const servicesCollection = getServicesCollection();
    const count = await servicesCollection.countDocuments();
    if (count === 0) {
      console.log("🌱 Seeding initial salon services into database...");
      await servicesCollection.insertMany(initialServices as any);
      console.log(`✅ Seeded ${initialServices.length} initial services.`);
    }
  } catch (error: any) {
    console.warn("⚠️ Could not run service seeder:", error.message);
  }
}
