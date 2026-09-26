import React, { useState, useEffect } from 'react'
import { Users, Search, Loader2, ChevronDown, Shield, User, X, BarChart3 } from 'lucide-react'
import { adminUserService } from '../../services/adminService'
import { useApp } from '../../contexts/AppContext'
import { formatDate, formatScore } from '../../lib/utils'

const ROLE_COLOR = { admin: 'bg-amber-100 text-amber-800', user: 'bg-blue-100 text-blue-700' }

function UserDrawer({ userId, profile, onClose }) {
  const { toast } = useApp()
  const [stats, setStats]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [changing, setChanging] = useState(false)

  useEffect(() => { load() }, [userId])

  async function load() {
    setLoading(true)
    try { setStats(await adminUserService.getUserStats(userId)) }
    catch (err) { toast.error(err.message) }
    finally { setLoading(false) }
  }

  async function handleRoleChange(newRole) {
    if (!window.confirm(`Change ${profile.full_name}'s role to ${newRole}?`)) return
    setChanging(true)
    try {
      await adminUserService.setRole(userId, newRole)
      toast.success('Role updated — page will reflect on next load')
      onClose()
    } catch (err) { toast.error(err.message) }
    finally { setChanging(false) }
  }

  const completed = stats?.attempts?.filter(a => a.status === 'completed') ?? []
  const avgAcc = completed.length
    ? (completed.reduce((s, a) => s + Number(a.accuracy ?? 0), 0) / completed.length).toFixed(1)
    : '—'

  return (
    <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-modal overflow-hidden animate-scale-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border">
          <h2 className="text-base font-bold text-body-text">User Profile</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-body-secondary" /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Identity */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-tnpsc-brand-light flex items-center justify-center text-tnpsc-brand font-bold text-xl">
              {profile.full_name?.charAt(0)?.toUpperCase() ?? 'U'}
            </div>
            <div>
              <p className="text-base font-bold text-body-text">{profile.full_name ?? '—'}</p>
              <p className="text-sm text-body-secondary">{profile.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 ${ROLE_COLOR[profile.role] ?? ROLE_COLOR.user}`}>{profile.role}</span>
                {profile.selected_exam && <span className="text-[10px] bg-slate-100 text-slate-600 rounded px-1.5 py-0.5">{profile.selected_exam}</span>}
              </div>
            </div>
          </div>

          {/* Stats */}
          {loading ? <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-tnpsc-brand" /></div> : (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Attempts',     value: stats?.attempts?.length ?? 0 },
                { label: 'Avg Accuracy', value: `${avgAcc}%` },
                { label: 'Recall Pts',   value: stats?.streak?.recall_points ?? 0 },
              ].map(({ label, value }) => (
                <div key={label} className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-body-text">{value}</p>
                  <p className="text-[10px] text-body-secondary">{label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Recent attempts */}
          {stats?.attempts?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-body-secondary uppercase tracking-wider mb-2">Recent Attempts</p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {stats.attempts.slice(0,5).map(a => (
                  <div key={a.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                    <span className="text-xs text-body-secondary">{formatDate(a.submitted_at).split(',')[0]}</span>
                    <span className={`text-xs font-bold ${a.status === 'completed' ? 'text-tnpsc-brand' : 'text-amber-600'}`}>
                      {a.status === 'completed' ? `${formatScore(a.score)}` : a.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Role management */}
          <div className="pt-2 border-t border-surface-border">
            <p className="text-xs font-bold text-body-secondary uppercase tracking-wider mb-2">Change Role</p>
            <div className="flex gap-2">
              {['user','admin'].map(r => (
                <button key={r} onClick={() => handleRoleChange(r)} disabled={changing || profile.role === r}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors capitalize ${profile.role === r ? 'bg-tnpsc-brand text-white border-tnpsc-brand' : 'bg-white border-surface-border text-body-secondary hover:border-tnpsc-brand/40 disabled:opacity-40'}`}>
                  {r}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-body-secondary mt-1.5">⚠ Role changes take effect immediately. Admin users have full platform access.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export function AdminUsersPage() {
  const { toast } = useApp()
  const [users, setUsers]     = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [selected, setSelected] = useState(null)

  useEffect(() => { load() }, [roleFilter])

  async function load() {
    setLoading(true)
    try { setUsers(await adminUserService.getAll({ role: roleFilter })) }
    catch (err) { toast.error(err.message) }
    finally { setLoading(false) }
  }

  const filtered = users.filter(u =>
    !search ||
    (u.full_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-tnpsc-brand" />
          <div>
            <h1 className="text-xl font-bold text-body-text">User Management</h1>
            <p className="text-xs text-body-secondary">{users.filter(u => u.role !== 'admin').length} students · {users.filter(u => u.role === 'admin').length} admins</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-body-secondary" />
          <input type="text" placeholder="Search name or email…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-surface-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-tnpsc-brand bg-white" />
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          className="border border-surface-border rounded-xl px-3 py-2 text-sm outline-none bg-white">
          <option value="all">All Roles</option>
          <option value="user">Students</option>
          <option value="admin">Admins</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-surface-border shadow-subtle overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-tnpsc-brand" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-body-secondary">No users found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-surface-border text-body-secondary uppercase font-semibold">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Exam</th>
                  <th className="py-3 px-4">Joined</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {filtered.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-tnpsc-brand-light text-tnpsc-brand font-bold text-xs flex items-center justify-center shrink-0">
                          {u.full_name?.charAt(0)?.toUpperCase() ?? 'U'}
                        </div>
                        <div>
                          <p className="font-semibold text-body-text">{u.full_name ?? '—'}</p>
                          <p className="text-body-secondary text-[11px]">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 ${ROLE_COLOR[u.role] ?? ROLE_COLOR.user}`}>{u.role}</span>
                    </td>
                    <td className="py-3 px-4 text-body-secondary">{u.selected_exam ?? '—'}</td>
                    <td className="py-3 px-4 text-body-secondary">{formatDate(u.created_at).split(',')[0]}</td>
                    <td className="py-3 px-4 text-right">
                      <button onClick={() => setSelected(u)}
                        className="px-3 py-1.5 bg-tnpsc-brand-light text-tnpsc-brand text-[11px] font-bold rounded-lg hover:bg-tnpsc-brand hover:text-white transition-colors">
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <UserDrawer userId={selected.id} profile={selected} onClose={() => { setSelected(null); load() }} />
      )}
    </div>
  )
}
