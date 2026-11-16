import { useEffect, useState, type FormEvent } from 'react'
import type { Role, User } from '../../../shared/auth'
import type { Language } from '../../../shared/settings'
import { formatDateTime } from '../money'

interface Props {
  language: Language
}

const copy = {
  en: {
    title: 'Users & roles',
    intro: 'Create staff accounts, assign roles, disable access, and reset passwords.',
    add: 'Add user',
    edit: 'Edit',
    cancel: 'Cancel',
    save: 'Save',
    saving: 'Saving...',
    username: 'Username',
    password: 'Password',
    newPassword: 'New password (leave empty to keep)',
    role: 'Role',
    permissions: 'Custom permissions (optional)',
    active: 'Active',
    status: 'Status',
    created: 'Created',
    noUsers: 'No users yet.',
    roles: 'Built-in roles',
    usernameRequired: 'Username is required.',
    passwordRequired: 'Password must be at least 3 characters.',
    error: 'Could not save user',
    saved: 'Saved successfully.',
    columns: ['Username', 'Role', 'Status', 'Created', ''],
    activeLabel: 'Active',
    inactiveLabel: 'Disabled',
    editTitle: 'Edit user',
    totalUsers: 'Total users',
    activeUsers: 'Active',
    disabledUsers: 'Disabled',
    searchUsers: 'Search users...',
    noSearchResults: 'No users match your search.'
  },
  ar: {
    title: 'المستخدمون والأدوار',
    intro: 'أنشئ حسابات الموظفين وحدد الأدوار وأوقف الوصول وأعد تعيين كلمات المرور.',
    add: 'إضافة مستخدم',
    edit: 'تعديل',
    cancel: 'إلغاء',
    save: 'حفظ',
    saving: 'جارٍ الحفظ...',
    username: 'اسم المستخدم',
    password: 'كلمة المرور',
    newPassword: 'كلمة مرور جديدة (اتركها فارغة للإبقاء على الحالية)',
    role: 'الدور',
    permissions: 'صلاحيات مخصصة (اختياري)',
    active: 'نشط',
    status: 'الحالة',
    created: 'تاريخ الإنشاء',
    noUsers: 'لا يوجد مستخدمون بعد.',
    roles: 'الأدوار المضمنة',
    usernameRequired: 'اسم المستخدم مطلوب.',
    passwordRequired: 'كلمة المرور يجب أن تكون 3 أحرف على الأقل.',
    error: 'تعذر حفظ المستخدم',
    saved: 'تم الحفظ بنجاح.',
    columns: ['اسم المستخدم', 'الدور', 'الحالة', 'تاريخ الإنشاء', ''],
    activeLabel: 'نشط',
    inactiveLabel: 'موقوف',
    editTitle: 'تعديل المستخدم',
    totalUsers: 'إجمالي المستخدمين',
    activeUsers: 'نشط',
    disabledUsers: 'موقوف',
    searchUsers: 'ابحث عن مستخدم...',
    noSearchResults: 'لا يوجد مستخدمون مطابقون للبحث.'
  }
} as const

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export default function UsersPage({ language }: Props) {
  const text = copy[language]
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('Seller')
  const [active, setActive] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [query, setQuery] = useState('')

  const activeUsers = users.filter((user) => user.active !== false).length
  const filteredUsers = users.filter((user) => {
    const search = query.trim().toLowerCase()
    if (!search) return true
    return user.username.toLowerCase().includes(search) || user.role.toLowerCase().includes(search)
  })

  async function load(): Promise<void> {
    if (!window.api) return
    const [loadedUsers, loadedRoles] = await Promise.all([window.api.usersList(), window.api.rolesList()])
    setUsers(loadedUsers)
    setRoles(loadedRoles)
  }

  useEffect(() => {
    void load().catch((loadError) => setError(message(loadError)))
  }, [])

  function resetMessages(): void {
    setError('')
    setSuccess('')
  }

  function openCreate(): void {
    resetMessages()
    setCreating(true)
    setEditing(null)
    setUsername('')
    setPassword('')
    setRole('Seller')
    setActive(true)
  }

  function openEdit(user: User): void {
    resetMessages()
    setCreating(false)
    setEditing(user)
    setUsername(user.username)
    setPassword('')
    setRole(user.role)
    setActive(user.active !== false)
  }

  function closeForm(): void {
    setCreating(false)
    setEditing(null)
    setUsername('')
    setPassword('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    resetMessages()
    const trimmed = username.trim()
    if (!trimmed) return setError(text.usernameRequired)
    if (!editing && password.length < 3) return setError(text.passwordRequired)
    if (editing && password && password.length < 3) return setError(text.passwordRequired)
    setBusy(true)
    try {
      if (editing?._id) {
        await window.api.usersUpdate(editing._id, {
          role,
          active,
          ...(password ? { password } : {})
        })
      } else {
        await window.api.usersCreate({
          username: trimmed,
          password,
          role,
          active
        })
      }
      closeForm()
      await load()
      setSuccess(text.saved)
    } catch (saveError) {
      setError(`${text.error}: ${message(saveError)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel users-page" aria-labelledby="users-title">
      <div className="section-header">
        <div>
          <h2 id="users-title">{text.title}</h2>
          <p className="muted">{text.intro}</p>
        </div>
        <button type="button" className="primary" onClick={openCreate}>{text.add}</button>
      </div>

      {error ? <p className="error" role="alert">{error}</p> : null}
      {success ? <p className="success" role="status">{success}</p> : null}

      {creating || editing ? (
        <form className="crud-form" onSubmit={handleSubmit}>
          <div className="crud-form-header">
            <h3>{editing ? `${text.editTitle}: ${editing.username}` : text.add}</h3>
            <button type="button" className="link-button" onClick={closeForm}>{text.cancel}</button>
          </div>
          <div className="crud-grid">
            <label>
              <span>{text.username}</span>
              <input value={username} onChange={(event) => setUsername(event.target.value)} disabled={Boolean(editing)} required maxLength={60} />
            </label>
            <label>
              <span>{editing ? text.newPassword : text.password}</span>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required={!editing} maxLength={120} />
            </label>
            <label>
              <span>{text.role}</span>
              <select value={role} onChange={(event) => setRole(event.target.value)}>
                {roles.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
              </select>
            </label>
            <label className="checkbox">
              <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
              <span>{text.active}</span>
            </label>
          </div>
          <div className="form-actions">
            <button type="submit" className="primary" disabled={busy}>{busy ? text.saving : text.save}</button>
            <button type="button" onClick={closeForm}>{text.cancel}</button>
          </div>
        </form>
      ) : null}

      <div className="kpi-grid">
        <div className="kpi-card">
          <span>{text.totalUsers}</span>
          <strong>{users.length}</strong>
        </div>
        <div className="kpi-card">
          <span>{text.activeUsers}</span>
          <strong className="ok-text">{activeUsers}</strong>
        </div>
        <div className="kpi-card">
          <span>{text.disabledUsers}</span>
          <strong className={users.length - activeUsers > 0 ? 'danger-text' : ''}>{users.length - activeUsers}</strong>
        </div>
      </div>

      <input
        className="user-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={text.searchUsers}
        aria-label={text.searchUsers}
      />

      {filteredUsers.length === 0 ? (
        <div className="empty-state">{query ? text.noSearchResults : text.noUsers}</div>
      ) : (
        <div className="user-grid">
          {filteredUsers.map((user) => (
            <article key={user._id ?? user.username} className={`user-card ${user.active === false ? 'inactive' : ''}`}>
              <div className="user-card-head">
                <span className="user-avatar">{(user.username || '?').slice(0, 1).toUpperCase()}</span>
                <div>
                  <strong>{user.username}</strong>
                  <small className="block-muted">{user.role}</small>
                </div>
                <span className={`tag ${user.active === false ? '' : 'ok-tag'}`}>
                  {user.active === false ? text.inactiveLabel : text.activeLabel}
                </span>
              </div>
              <dl className="stat-list">
                <div><dt>{text.created}</dt><dd>{formatDateTime(user.createdAt, language)}</dd></div>
              </dl>
              <div className="form-actions">
                <button type="button" onClick={() => openEdit(user)}>{text.edit}</button>
              </div>
            </article>
          ))}
        </div>
      )}

      <details className="roles-details">
        <summary>{text.roles}</summary>
        <div className="roles-grid">
          {roles.map((item) => (
            <div key={item.name}>
              <strong>{item.name}</strong>
              <small className="block-muted">{item.permissions.join(', ')}</small>
            </div>
          ))}
        </div>
      </details>
    </section>
  )
}
