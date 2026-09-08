import {
  BatteryWarning,
  Cable,
  Disc,
  Eye,
  Gamepad2,
  HardDrive,
  HelpCircle,
  Lock,
  MonitorOff,
  Plug,
  Power,
  ShieldCheck,
  Smartphone,
  Thermometer,
  Truck,
  Usb,
  Wrench,
  type LucideProps,
} from "lucide-react";

const ICONS: Record<string, React.ComponentType<LucideProps>> = {
  BatteryWarning,
  Cable,
  Disc,
  Eye,
  Gamepad2,
  HardDrive,
  HelpCircle,
  Lock,
  MonitorOff,
  Plug,
  Power,
  ShieldCheck,
  Smartphone,
  Thermometer,
  Truck,
  Usb,
  Wrench,
};

/** Renders a lucide icon by name (names are stored in the database). */
export function DynamicIcon({ name, className }: { name: string | null | undefined; className?: string }) {
  const Icon = (name && ICONS[name]) || Wrench;
  return <Icon className={className} aria-hidden="true" />;
}
