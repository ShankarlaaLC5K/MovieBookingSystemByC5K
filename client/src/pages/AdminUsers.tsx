
import { useEffect, useState } from "react";
import api from "../services/api";

interface ManagedUser {
  _id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  createdAt: string;
}

function AdminUsers() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const response = await api.get("/auth/admin/users");

      setUsers(response.data.users || []);
      setError("");
    } catch (e: any) {
      setError(
        e?.response?.data?.message || "Could not load users."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const updateRole = async (
    id: string,
    role: ManagedUser["role"]
  ) => {
    setError("");
    setMessage("");

    try {
      await api.patch(`/auth/admin/users/${id}/role`, {
        role,
      });

      setMessage("Role updated successfully.");
      await load();
    } catch (e: any) {
      setError(
        e?.response?.data?.message || "Could not update role."
      );
    }
  };

  return (
    <section className="min-h-screen bg-slate-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-bold">
          User Management
        </h1>

        <p className="mt-2 text-slate-400">
          Manage registered users and administrator roles.
          Only administrators can change roles.
        </p>

        {error && (
          <p className="mt-5 rounded-lg border border-red-800 bg-red-950 p-3 text-red-300">
            {error}
          </p>
        )}

        {message && (
          <p className="mt-5 rounded-lg border border-green-800 bg-green-950 p-3 text-green-300">
            {message}
          </p>
        )}

        {loading ? (
          <p className="mt-6 text-slate-400">
            Loading users...
          </p>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900 text-slate-300">
                <tr>
                  <th className="p-4">Name</th>
                  <th className="p-4">Email</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Change Role</th>
                </tr>
              </thead>

              <tbody>
                {users.map((item) => (
                  <tr
                    key={item._id}
                    className="border-t border-slate-800"
                  >
                    <td className="p-4">
                      {item.name}
                    </td>

                    <td className="p-4">
                      {item.email}
                    </td>

                    <td className="p-4">
                      {item.role}
                    </td>

                    <td className="p-4">
                      <select
                        aria-label={`Role for ${item.email}`}
                        className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
                        value={item.role}
                        onChange={(event) =>
                          void updateRole(
                            item._id,
                            event.target.value as ManagedUser["role"]
                          )
                        }
                      >
                        <option value="user">
                          User
                        </option>

                        <option value="admin">
                          Admin
                        </option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

export default AdminUsers;
