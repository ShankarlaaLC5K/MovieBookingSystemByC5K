import { Building2, CalendarDays, MonitorPlay, Ticket } from "lucide-react";
import { Link } from "react-router-dom";

function OwnerDashboard() {
  const sections = [
    { title: "My Theatres", description: "Create and manage your theatre details.", icon: Building2, path: "/admin/theatres" },
    { title: "Screens", description: "Manage screens for your theatres.", icon: MonitorPlay, path: "/admin/screens" },
    { title: "Show Schedules", description: "Create and manage shows for your theatres.", icon: CalendarDays, path: "/admin/shows" },
    { title: "Bookings", description: "Review bookings for your theatres.", icon: Ticket, path: "/admin/bookings" }
  ];
  return <section className="min-h-[calc(100vh-140px)] bg-slate-950 px-4 py-10 text-white"><div className="mx-auto max-w-7xl"><p className="text-sm font-semibold uppercase tracking-wider text-red-500">Theatre management</p><h1 className="mt-2 text-3xl font-bold sm:text-4xl">Theatre Owner Dashboard</h1><p className="mt-2 max-w-2xl text-slate-400">Manage only theatres assigned to your owner account. Access is verified by the backend.</p><div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{sections.map((section) => { const Icon = section.icon; return <Link key={section.title} to={section.path} className="group rounded-2xl border border-slate-800 bg-slate-900 p-6 transition hover:border-red-500/50"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 text-red-500"><Icon size={24} /></div><h2 className="mt-5 text-xl font-semibold">{section.title}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{section.description}</p><div className="mt-5 text-sm font-semibold text-red-400">Manage →</div></Link>; })}</div></div></section>;
}

export default OwnerDashboard;
