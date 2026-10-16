import {
  BarChart3,
  Building2,
  CalendarDays,
  Clapperboard,
  Film,
  MonitorPlay,
  Ticket,
  Users,
} from "lucide-react";

import { Link } from "react-router-dom";

function AdminDashboard() {
  const adminSections = [
    {
      title: "Movies",
      description: "Add, update and manage movies.",
      icon: Film,
      path: "/admin/movies",
    },
    {
      title: "Theatres",
      description: "Manage theatres and theatre details.",
      icon: Building2,
      path: "/admin/theatres",
    },
    {
      title: "Screens",
      description: "Manage screens and seating layouts.",
      icon: MonitorPlay,
      path: "/admin/screens",
    },
    {
      title: "Shows",
      description: "Create and manage movie shows.",
      icon: CalendarDays,
      path: "/admin/shows",
    },
    {
      title: "Bookings",
      description: "View and manage customer bookings.",
      icon: Ticket,
      path: "/admin/bookings",
    },
    {
      title: "Reports & Analytics",
      description:
        "View booking trends, sales and theatre performance.",
      icon: BarChart3,
      path: "/admin/reports",
    },
    {
      title: "User Management",
      description: "Manage registered users and administrator roles.",
      icon: Users,
      path: "/admin/users",
    },
    {
      title: "Movie System",
      description:
        "Manage the complete movie booking system.",
      icon: Clapperboard,
      path: "/movies",
    },
  ];

  return (
    <section className="min-h-[calc(100vh-140px)] bg-slate-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-7xl">

        <div className="mb-10">
          <p className="text-sm font-semibold uppercase tracking-wider text-red-500">
            Administration
          </p>

          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
            Admin Dashboard
          </h1>

          <p className="mt-2 max-w-2xl text-slate-400">
            Manage movies, theatres, screens, shows,
            bookings and analytics from one place.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {adminSections.map((section) => {
            const Icon = section.icon;

            return (
              <Link
                key={section.title}
                to={section.path}
                className="group rounded-2xl border border-slate-800 bg-slate-900 p-6 transition hover:-translate-y-1 hover:border-red-500/40 hover:bg-slate-900/80"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 text-red-500 transition group-hover:bg-red-500 group-hover:text-white">
                  <Icon size={24} />
                </div>

                <h2 className="mt-5 text-xl font-semibold">
                  {section.title}
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {section.description}
                </p>

                <div className="mt-5 text-sm font-semibold text-red-400">
                  Manage →
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-lg font-semibold">
            Admin Control Center
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            Use the sections above to manage the complete
            movie ticket booking workflow and monitor
            system performance through reports and analytics.
          </p>
        </div>

      </div>
    </section>
  );
}

export default AdminDashboard;