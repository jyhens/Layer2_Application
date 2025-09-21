import React from "react";
import type { Customer } from "../types";
import { PencilIcon, TrashIcon } from "./Icons";
import { api } from "../api";

type Props = {
  customers: Customer[];
};

const CustomerManagement: React.FC<Props> = ({ customers }) => {
  const [items, setItems] = React.useState<Customer[]>(customers);
  const [loading, setLoading] = React.useState(false);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Partial<Customer> | null>(null);
  const [name, setName] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<Array<{ id: string; name: string }>>("/api/customers");
      setItems(res.data.map(c => ({ id: c.id, name: c.name })));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setModalOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setName(c.name);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setName("");
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    if (editing?.id) {
      await api.put(`/api/customers/${editing.id}`, { name: trimmed });
    } else {
      await api.post("/api/customers", { name: trimmed });
    }
    await load();
    closeModal();
  };

  const remove = async (c: Customer) => {
    if (!window.confirm(`Soll der Kunde „${c.name}“ wirklich gelöscht werden?`)) return;
    await api.delete(`/api/customers/${c.id}`);
    await load();
  };

  return (
    <div>
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={closeModal}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={save}>
              <div className="p-6">
                <h3 className="text-lg font-medium leading-6 text-gray-900">
                  {editing?.id ? "Kunde bearbeiten" : "Neuen Kunden hinzufügen"}
                </h3>
                <div className="mt-4">
                  <label htmlFor="cust-name" className="block text-sm font-medium text-gray-700">
                    Kundenname
                  </label>
                  <input
                    id="cust-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2"
                    required
                  />
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse rounded-b-lg">
                <button
                  type="submit"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary text-base font-medium text-white hover:bg-blue-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Speichern
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:w-auto sm:text-sm"
                >
                  Abbrechen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-text-primary">Kunden</h2>
        <button
          onClick={openCreate}
          className="inline-flex items-center justify-center rounded-md border border-transparent bg-primary py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          Kunde hinzufügen
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="relative px-6 py-3">
                <span className="sr-only">Aktionen</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={2} className="px-6 py-6 text-sm text-slate-500">Lade…</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-6 py-6 text-sm text-slate-500">Keine Kunden gefunden.</td>
              </tr>
            ) : (
              items.map((c) => (
                <tr key={c.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{c.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => openEdit(c)}
                        className="text-primary hover:text-blue-700"
                        aria-label={`${c.name} bearbeiten`}
                        title="Bearbeiten"
                      >
                        <PencilIcon className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => remove(c)}
                        className="text-danger hover:text-red-700"
                        aria-label={`${c.name} löschen`}
                        title="Löschen"
                      >
                        <TrashIcon className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CustomerManagement;
