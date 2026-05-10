import { Plus, X, Upload, FileText } from 'lucide-react'

interface ProjectRow {
  title: string
  url?: string
  description?: string
}

interface LinksMap {
  github?: string
  website?: string
  linkedin?: string
}

interface Props {
  skills: string[]
  setSkills: (next: string[]) => void
  projects: ProjectRow[]
  setProjects: (next: ProjectRow[]) => void
  links: LinksMap
  setLinks: (next: LinksMap) => void
  defaultResume: { path: string | null; pending: File | null }
  setDefaultResume: (next: { path: string | null; pending: File | null }) => void
}

/**
 * Phase 2.1 — student-only profile sections. Owns the form state for
 * skills (chip input), projects (≤4 with title/url/description), links
 * (github/website/linkedin), and the default-resume upload. Parent
 * Profile.tsx writes these to the DB on save.
 *
 * Validation mirrors the server-side trigger from migration 066 so
 * users get inline feedback before a save round-trip.
 */
export default function StudentSectionsEditor({
  skills, setSkills, projects, setProjects, links, setLinks, defaultResume, setDefaultResume,
}: Props) {
  function addSkill(raw: string) {
    const next = raw.trim().slice(0, 30)
    if (!next) return
    if (skills.length >= 12) return
    if (skills.includes(next)) return
    setSkills([...skills, next])
  }

  function addProject() {
    if (projects.length >= 4) return
    setProjects([...projects, { title: '' }])
  }

  function updateProject(i: number, patch: Partial<ProjectRow>) {
    setProjects(projects.map((p, idx) => idx === i ? { ...p, ...patch } : p))
  }

  function removeProject(i: number) {
    setProjects(projects.filter((_, idx) => idx !== i))
  }

  function onPickResume(file: File | null) {
    if (!file) { setDefaultResume({ ...defaultResume, pending: null }); return }
    if (file.size > 5 * 1024 * 1024) { alert('Resume PDF must be 5 MB or less.'); return }
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
      alert('Resume must be a PDF.')
      return
    }
    setDefaultResume({ ...defaultResume, pending: file })
  }

  return (
    <div className="space-y-5">
      {/* Skills */}
      <div>
        <label className="block text-sm font-medium text-ink mb-1.5">
          Skills <span className="text-ink-muted font-normal">(optional · max 12)</span>
        </label>
        <p className="text-xs text-ink-muted mb-2">Short tags — press Enter to add. e.g. "Python", "Video editing".</p>
        <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-lg border border-border bg-surface min-h-[44px]">
          {skills.map((s, i) => (
            <span
              key={s + i}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary-muted text-primary text-xs font-medium"
            >
              {s}
              <button
                type="button"
                onClick={() => setSkills(skills.filter((_, idx) => idx !== i))}
                className="hover:text-primary-light"
                aria-label={`Remove ${s}`}
              >
                <X size={11} />
              </button>
            </span>
          ))}
          <input
            type="text"
            maxLength={30}
            placeholder={skills.length === 0 ? 'Add a skill…' : ''}
            disabled={skills.length >= 12}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault()
                addSkill((e.target as HTMLInputElement).value)
                ;(e.target as HTMLInputElement).value = ''
              }
            }}
            onBlur={(e) => {
              if (e.target.value.trim()) {
                addSkill(e.target.value)
                e.target.value = ''
              }
            }}
            className="flex-1 min-w-[120px] bg-transparent text-sm text-ink placeholder:text-ink-placeholder focus:outline-none"
          />
        </div>
      </div>

      {/* Projects */}
      <div>
        <label className="block text-sm font-medium text-ink mb-1.5">
          Projects <span className="text-ink-muted font-normal">(optional · max 4)</span>
        </label>
        <div className="space-y-3">
          {projects.map((p, i) => (
            <div key={i} className="p-3 rounded-lg border border-border bg-primary-faint space-y-2">
              <div className="flex items-start gap-2">
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={p.title}
                  onChange={(e) => updateProject(i, { title: e.target.value })}
                  placeholder="Title (required)"
                  className="flex-1 px-3 py-2 rounded-lg border border-border bg-surface text-ink text-sm placeholder:text-ink-placeholder focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => removeProject(i)}
                  className="text-ink-muted hover:text-error p-1"
                  aria-label="Remove project"
                >
                  <X size={14} />
                </button>
              </div>
              <input
                type="url"
                value={p.url ?? ''}
                onChange={(e) => updateProject(i, { url: e.target.value })}
                placeholder="https://… (optional)"
                className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-ink text-sm placeholder:text-ink-placeholder focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
              <textarea
                rows={2}
                maxLength={200}
                value={p.description ?? ''}
                onChange={(e) => updateProject(i, { description: e.target.value })}
                placeholder="What it is (≤200 chars, optional)"
                className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-ink text-sm placeholder:text-ink-placeholder resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
          ))}
        </div>
        {projects.length < 4 && (
          <button
            type="button"
            onClick={addProject}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-light"
          >
            <Plus size={13} /> Add project
          </button>
        )}
      </div>

      {/* Links */}
      <div>
        <label className="block text-sm font-medium text-ink mb-1.5">
          Links <span className="text-ink-muted font-normal">(optional)</span>
        </label>
        <div className="space-y-2">
          {([
            { key: 'github', label: 'GitHub', placeholder: 'https://github.com/you' },
            { key: 'website', label: 'Personal site', placeholder: 'https://example.com' },
            { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/you' },
          ] as const).map(({ key, label, placeholder }) => (
            <div key={key} className="grid grid-cols-[120px_1fr] gap-2 items-center">
              <span className="text-xs text-ink-muted">{label}</span>
              <input
                type="url"
                value={links[key] ?? ''}
                onChange={(e) => setLinks({ ...links, [key]: e.target.value })}
                placeholder={placeholder}
                className="px-3 py-2 rounded-lg border border-border bg-surface text-ink text-sm placeholder:text-ink-placeholder focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Default resume */}
      <div>
        <label className="block text-sm font-medium text-ink mb-1.5">
          Default resume <span className="text-ink-muted font-normal">(PDF, 5 MB max — used when you apply)</span>
        </label>
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-surface text-sm text-ink-secondary hover:bg-primary-faint cursor-pointer">
            <Upload size={13} />
            {defaultResume.pending ? 'Change file' : defaultResume.path ? 'Replace' : 'Choose PDF'}
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => onPickResume(e.target.files?.[0] ?? null)}
              className="hidden"
            />
          </label>
          {defaultResume.pending ? (
            <span className="text-xs text-ink">
              <FileText size={12} className="inline mr-1" />
              {defaultResume.pending.name} ({(defaultResume.pending.size / 1024).toFixed(0)} KB) · saves on submit
            </span>
          ) : defaultResume.path ? (
            <span className="text-xs text-ink-muted flex items-center gap-1">
              <FileText size={12} /> Saved
              <button
                type="button"
                onClick={() => setDefaultResume({ path: null, pending: null })}
                className="ml-2 text-error hover:underline"
              >
                Remove
              </button>
            </span>
          ) : (
            <span className="text-xs text-ink-muted">No default resume yet.</span>
          )}
        </div>
      </div>
    </div>
  )
}
