import {
  BookOpen,
  BrainCircuit,
  ClipboardCheck,
  FileQuestion,
  GraduationCap,
  Instagram,
  LockKeyhole,
  Mail,
  MessageCircle,
  MessagesSquare,
  Send,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

import type {
  Contributor,
  DashboardCardItem,
} from "./dashboardTypes";
import pykiddaQrAsset from "@/assets/pykidda_qr.png.asset.json";

export const learningCards: DashboardCardItem[] = [
  {
    id: "python-learning",
    eyebrow: "Build your foundation",
    title: "Python Learning",
    description:
      "Learn Python step by step through simple lessons, examples and guided activities.",
    actionLabel: "Start Learning",
    href: "/learning",
    icon: <BookOpen aria-hidden="true" />,
    color: "orange",
    badge: "Learn",
    details: ["Beginner friendly", "Structured lessons", "Track your progress"],
  },
  {
    id: "mock-tests",
    eyebrow: "Test your knowledge",
    title: "Mock Tests",
    description:
      "Attempt secure Python mock tests and understand your performance through useful feedback.",
    actionLabel: "Take a Mock Test",
    href: "/mock-tests",
    icon: <ClipboardCheck aria-hidden="true" />,
    color: "blue",
    badge: "Test",
    details: ["Timed tests", "Instant results", "Performance insights"],
  },
  {
    id: "practice-questions",
    eyebrow: "Strengthen your skills",
    title: "Practice Questions",
    description:
      "Solve Python questions regularly and improve your coding confidence one problem at a time.",
    actionLabel: "Start Practising",
    href: "/practice",
    icon: <FileQuestion aria-hidden="true" />,
    color: "purple",
    badge: "Practise",
    details: ["Topic-wise questions", "Coding practice", "Helpful explanations"],
  },
  {
    id: "homework",
    eyebrow: "Complete your work",
    title: "Homework",
    description:
      "View assigned homework, complete it before the deadline and receive teacher feedback.",
    actionLabel: "View Homework",
    href: "/homework",
    icon: <GraduationCap aria-hidden="true" />,
    color: "green",
    badge: "Grow",
    details: ["Clear deadlines", "Submission tracking", "Teacher feedback"],
  },
];

export const contactCards: DashboardCardItem[] = [
  {
    id: "whatsapp",
    eyebrow: "Quick assistance",
    title: "WhatsApp",
    description:
      "Connect with the PY Kidda community and receive important learning updates.",
    actionLabel: "Open WhatsApp",
    href: "#",
    icon: <MessageCircle aria-hidden="true" />,
    color: "green",
    badge: "Chat",
  },
  {
    id: "telegram",
    eyebrow: "Join the community",
    title: "Telegram",
    description:
      "Get announcements, useful Python resources and community updates in one place.",
    actionLabel: "Join Telegram",
    href: "#",
    icon: <Send aria-hidden="true" />,
    color: "blue",
    badge: "Community",
  },
  {
    id: "instagram",
    eyebrow: "Follow our journey",
    title: "Instagram",
    description:
      "Discover learning tips, platform updates and highlights from the PY Kidda community.",
    actionLabel: "Follow Instagram",
    href: "https://www.instagram.com/pykidda/",
    icon: <Instagram aria-hidden="true" />,
    color: "pink",
    badge: "Follow",
    backgroundImage: pykiddaQrAsset.url,
  },
  {
    id: "contact-us",
    eyebrow: "We are here to help",
    title: "Contact Us",
    description:
      "Have a question or need support? Contact the PY Kidda team directly.",
    actionLabel: "Contact the Team",
    href: "mailto:pykidda@gmail.com",
    icon: <Mail aria-hidden="true" />,
    color: "orange",
    badge: "Support",
  },
];

export const whyPyKiddaCards: DashboardCardItem[] = [
  {
    id: "safe-mock-tests",
    eyebrow: "Fair assessment",
    title: "Safe Mock Tests",
    description:
      "Focused and carefully monitored mock tests help create a fair assessment environment.",
    actionLabel: "Explore Mock Tests",
    href: "/mock-tests",
    icon: <ShieldCheck aria-hidden="true" />,
    color: "green",
    badge: "Secure",
  },
  {
    id: "data-safety",
    eyebrow: "Protected information",
    title: "Data Safety",
    description:
      "Student information and learning activity are handled carefully using secure systems.",
    actionLabel: "Learn More",
    href: "#",
    icon: <LockKeyhole aria-hidden="true" />,
    color: "blue",
    badge: "Protected",
  },
  {
    id: "manual-grading",
    eyebrow: "Meaningful feedback",
    title: "Teacher Manual Grading",
    description:
      "Teachers can review student answers manually and provide fair, useful feedback.",
    actionLabel: "View the Process",
    href: "#",
    icon: <UserCheck aria-hidden="true" />,
    color: "purple",
    badge: "Reviewed",
  },
  {
    id: "doubt-solving",
    eyebrow: "Learning support",
    title: "Doubt Solving",
    description:
      "Students can ask questions, clear doubts and continue learning with confidence.",
    actionLabel: "Get Support",
    href: "#",
    icon: <MessagesSquare aria-hidden="true" />,
    color: "orange",
    badge: "Supported",
  },
];

export const contributors: Contributor[] = [
  {
    id: "meenakshi-pawar",
    name: "Dr. Meenakshi Mukund Pawar",
    post: "Vice Principal, SVERI College",
    help: "Testing & Funding",
    image: "/contributors/meenakshi-pawar.jpg",
  },
  {
    id: "prashant-pawar",
    name: "Dr. Prashant Maruti Pawar",
    post: "Professor, SVERI College",
    help: "Testing & Funding",
    image: "/contributors/prashant-pawar.jpg",
  },
  {
    id: "vaishnavi-jadhav",
    name: "Vaishnavi Jadhav",
    post: "Lab Assistant",
    help: "Testing & Developing",
    image: "/contributors/vaishnavi-jadhav.jpg",
  },
];

export const creator = {
  name: "Siddharth Pawar",
  description:
    "I am Siddharth Pawar, and I have created this platform for students who want to learn, code and then grow.",
  phoneDisplay: "+91 91725 04205",
  phoneHref: "tel:+919172504205",
  email: "pykidda@gmail.com",
  emailHref: "mailto:pykidda@gmail.com",
  image: "/contributors/siddharth-pawar.jpg",
  icon: <BrainCircuit aria-hidden="true" />,
};
