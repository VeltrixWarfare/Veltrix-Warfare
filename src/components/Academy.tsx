import { useCallback, useEffect, useMemo, useState } from 'react'
import { Archive, ArrowRight, BookOpen, Check, ChevronDown, ChevronRight, Download, FileText, GraduationCap, Pencil, Plus, RefreshCw, Save, Trash2, Upload, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Course = { id: string; title: string; description: string | null; level: string; sort_order: number; status: 'draft'|'published'|'archived' }
type Chapter = { id: string; course_id: string; title: string; description: string | null; sort_order: number; status: 'draft'|'published'|'archived' }
type Lesson = { id: string; chapter_id: string; title: string; summary: string | null; content: string; duration_minutes: number; sort_order: number; status: 'draft'|'published'|'archived' }
type Resource = { id: string; lesson_id: string; file_name: string; file_path: string; mime_type: string | null; size_bytes: number | null }
type EditorKind = 'course'|'chapter'|'lesson'
type EditorState = { kind: EditorKind; id?: string; parentId?: string } | null

const emptyForm = { title: '', description: '', summary: '', content: '', level: 'Beginner', duration_minutes: 10, sort_order: 0 }
const readableError = (error: unknown) => error instanceof Error ? error.message : 'Terjadi kesalahan. Coba lagi.'

export default function Academy({ isAdmin }: { isAdmin: boolean }) {
  const [courses, setCourses] = useState<Course[]>([])
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [resources, setResources] = useState<Resource[]>([])
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null)
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null)
  const [selectedLesson, setSelectedLesson] = useState<string | null>(null)
  const [editor, setEditor] = useState<EditorState>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [filter, setFilter] = useState<'published'|'all'|'draft'|'archived'>('published')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    if (!supabase) { setError('Supabase belum dikonfigurasi.'); setLoading(false); return }
    setLoading(true); setError('')
    try {
      const [c, ch, l, r] = await Promise.all([
        supabase.from('academy_courses').select('*').order('sort_order').order('created_at'),
        supabase.from('academy_chapters').select('*').order('sort_order').order('created_at'),
        supabase.from('academy_lessons').select('*').order('sort_order').order('created_at'),
        supabase.from('academy_resources').select('*').order('created_at'),
      ])
      const failed = [c.error, ch.error, l.error, r.error].find(Boolean)
      if (failed) throw failed
      const nextCourses = (c.data || []) as Course[]
      setCourses(nextCourses); setChapters((ch.data || []) as Chapter[]); setLessons((l.data || []) as Lesson[]); setResources((r.data || []) as Resource[])
      setSelectedCourse(old => old && nextCourses.some(x => x.id === old) ? old : nextCourses.find(x => x.status === 'published')?.id || nextCourses[0]?.id || null)
    } catch (e) { setError(`${readableError(e)}. Pastikan migration Academy sudah dijalankan di Supabase.`) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!supabase) return
    const channel = supabase.channel('academy-live-content').on('postgres_changes', { event: '*', schema: 'public', table: 'academy_courses' }, () => void load()).on('postgres_changes', { event: '*', schema: 'public', table: 'academy_chapters' }, () => void load()).on('postgres_changes', { event: '*', schema: 'public', table: 'academy_lessons' }, () => void load()).on('postgres_changes', { event: '*', schema: 'public', table: 'academy_resources' }, () => void load()).subscribe()
    return () => { void supabase?.removeChannel(channel) }
  }, [load])

  const visibleCourses = useMemo(() => courses.filter(x => isAdmin ? (filter === 'all' || x.status === filter) : x.status === 'published'), [courses, filter, isAdmin])
  const course = courses.find(x => x.id === selectedCourse) || null
  const courseChapters = chapters.filter(x => x.course_id === selectedCourse && (isAdmin || x.status === 'published'))
  const chapter = chapters.find(x => x.id === selectedChapter) || null
  const chapterLessons = lessons.filter(x => x.chapter_id === selectedChapter && (isAdmin || x.status === 'published'))
  const lesson = lessons.find(x => x.id === selectedLesson) || null
  const lessonResources = resources.filter(x => x.lesson_id === selectedLesson)

  useEffect(() => {
    if (!courseChapters.some(x => x.id === selectedChapter)) setSelectedChapter(courseChapters[0]?.id || null)
  }, [selectedCourse, chapters, selectedChapter, isAdmin])
  useEffect(() => {
    if (!chapterLessons.some(x => x.id === selectedLesson)) setSelectedLesson(chapterLessons[0]?.id || null)
  }, [selectedChapter, lessons, selectedLesson, isAdmin])

  const beginCreate = (kind: EditorKind, parentId?: string) => { if (kind === 'course') setFilter('all'); setForm({ ...emptyForm, sort_order: kind === 'course' ? courses.length + 1 : kind === 'chapter' ? chapters.filter(x => x.course_id === parentId).length + 1 : lessons.filter(x => x.chapter_id === parentId).length + 1 }); setEditor({ kind, parentId }) }
  const beginEdit = (kind: EditorKind, item: Course | Chapter | Lesson) => {
    const row = item as any
    setForm({ title: row.title || '', description: row.description || '', summary: row.summary || '', content: row.content || '', level: row.level || 'Beginner', duration_minutes: row.duration_minutes || 10, sort_order: row.sort_order || 0 })
    setEditor({ kind, id: row.id, parentId: row.course_id || row.chapter_id })
  }
  const save = async () => {
    if (!supabase || !editor || !isAdmin) return
    if (!form.title.trim()) { setError('Judul wajib diisi.'); return }
    setSaving(true); setError(''); setMessage('')
    try {
      const common = { title: form.title.trim(), sort_order: Number(form.sort_order) || 0 }
      let result
      if (editor.kind === 'course') {
        const payload = { ...common, description: form.description.trim() || null, level: form.level }
        result = editor.id ? await supabase.from('academy_courses').update(payload).eq('id', editor.id) : await supabase.from('academy_courses').insert(payload).select('id').single()
      } else if (editor.kind === 'chapter') {
        const payload = { ...common, course_id: editor.parentId, description: form.description.trim() || null }
        result = editor.id ? await supabase.from('academy_chapters').update(payload).eq('id', editor.id) : await supabase.from('academy_chapters').insert(payload).select('id').single()
      } else {
        const payload = { ...common, chapter_id: editor.parentId, summary: form.summary.trim() || null, content: form.content, duration_minutes: Math.max(1, Number(form.duration_minutes) || 1) }
        result = editor.id ? await supabase.from('academy_lessons').update(payload).eq('id', editor.id) : await supabase.from('academy_lessons').insert(payload).select('id').single()
      }
      if (result.error) throw result.error
      const newId = (result.data as any)?.id
      await load()
      if (editor.kind === 'course') setSelectedCourse(editor.id || newId || selectedCourse)
      if (editor.kind === 'chapter') setSelectedChapter(editor.id || newId || selectedChapter)
      if (editor.kind === 'lesson') setSelectedLesson(editor.id || newId || selectedLesson)
      setEditor(null); setMessage('Perubahan berhasil disimpan.')
    } catch (e) { setError(readableError(e)) }
    finally { setSaving(false) }
  }

  const setStatus = async (kind: EditorKind, id: string, status: 'draft'|'published'|'archived') => {
    if (!supabase || !isAdmin) return
    const table = kind === 'course' ? 'academy_courses' : kind === 'chapter' ? 'academy_chapters' : 'academy_lessons'
    const { error: updateError } = await supabase.from(table).update({ status }).eq('id', id)
    if (updateError) setError(updateError.message); else { setMessage(`Status berhasil diubah menjadi ${status}.`); await load() }
  }
  const remove = async (kind: EditorKind, id: string) => {
    if (!supabase || !isAdmin || !window.confirm('Hapus permanen item ini? Tindakan ini tidak dapat dibatalkan.')) return
    const table = kind === 'course' ? 'academy_courses' : kind === 'chapter' ? 'academy_chapters' : 'academy_lessons'
    try {
      // Remove private Storage objects before cascading their metadata rows.
      let lessonIds: string[] = []
      if (kind === 'lesson') lessonIds = [id]
      if (kind === 'chapter') { const { data, error: qError } = await supabase.from('academy_lessons').select('id').eq('chapter_id', id); if (qError) throw qError; lessonIds = (data || []).map((x: any) => x.id) }
      if (kind === 'course') {
        const { data: chRows, error: chError } = await supabase.from('academy_chapters').select('id').eq('course_id', id); if (chError) throw chError
        const chIds = (chRows || []).map((x: any) => x.id)
        if (chIds.length) { const { data, error: lError } = await supabase.from('academy_lessons').select('id').in('chapter_id', chIds); if (lError) throw lError; lessonIds = (data || []).map((x: any) => x.id) }
      }
      if (lessonIds.length) { const { data: files, error: fError } = await supabase.from('academy_resources').select('file_path').in('lesson_id', lessonIds); if (fError) throw fError; const paths = (files || []).map((x: any) => x.file_path); if (paths.length) { const { error: storageError } = await supabase.storage.from('academy-files').remove(paths); if (storageError) throw storageError } }
      const { error: deleteError } = await supabase.from(table).delete().eq('id', id)
      if (deleteError) throw deleteError
      setMessage('Item berhasil dihapus.'); if (kind === 'course') setSelectedCourse(null); if (kind === 'chapter') setSelectedChapter(null); if (kind === 'lesson') setSelectedLesson(null); await load()
    } catch (e) { setError(readableError(e)) }
  }
  const uploadResource = async (file?: File) => {
    if (!supabase || !isAdmin || !lesson || !file) return
    if (file.size > 25 * 1024 * 1024) { setError('Ukuran file maksimal 25 MB.'); return }
    setUploading(true); setError('')
    try {
      const safeName = file.name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g, '-').slice(-100)
      const path = `${lesson.id}/${crypto.randomUUID()}-${safeName}`
      const { error: uploadError } = await supabase.storage.from('academy-files').upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false })
      if (uploadError) throw uploadError
      const { error: insertError } = await supabase.from('academy_resources').insert({ lesson_id: lesson.id, file_name: file.name, file_path: path, mime_type: file.type || null, size_bytes: file.size })
      if (insertError) { await supabase.storage.from('academy-files').remove([path]); throw insertError }
      await load(); setMessage('File materi berhasil diunggah.')
    } catch (e) { setError(readableError(e)) }
    finally { setUploading(false) }
  }
  const openResource = async (resource: Resource) => {
    if (!supabase) return
    const { data, error: signedError } = await supabase.storage.from('academy-files').createSignedUrl(resource.file_path, 60)
    if (signedError) { setError(signedError.message); return }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }
  const deleteResource = async (resource: Resource) => {
    if (!supabase || !isAdmin || !window.confirm(`Hapus file ${resource.file_name}?`)) return
    const [storageResult, rowResult] = await Promise.all([supabase.storage.from('academy-files').remove([resource.file_path]), supabase.from('academy_resources').delete().eq('id', resource.id)])
    if (storageResult.error || rowResult.error) setError(storageResult.error?.message || rowResult.error?.message || 'Gagal menghapus file.')
    else { setMessage('File berhasil dihapus.'); await load() }
  }

  return <>
    <div className="page-intro"><div className="section-kicker">03 / LEARNING</div><h1>Build your trading foundation.</h1><p>Structured learning paths designed to strengthen process, market understanding, and risk awareness.</p></div>
    <section className="academy-feature glass-panel"><div className="feature-copy"><span className="section-kicker">THE VELTRIX ACADEMY</span><h2>Learn the process.<br/><em>Not the shortcut.</em></h2><p>Education-first material for building a repeatable and risk-aware approach to markets.</p><span className="academy-live-state"><i/> CONTENT {loading ? 'SYNCING' : 'CONNECTED'}</span></div><div className="feature-graphic"><GraduationCap size={62} strokeWidth={1}/><span>VW / ACADEMY</span></div></section>
    {isAdmin && <section className="glass-panel academy-admin-toolbar"><div><span className="section-kicker">ACADEMY MANAGEMENT</span><h3>Content studio</h3><p>Kelola kurikulum tanpa mengubah kode website.</p></div><div className="academy-admin-actions"><button className="button button-outline" onClick={() => void load()}><RefreshCw size={14}/> Refresh</button><button className="button button-primary" onClick={() => beginCreate('course')}><Plus size={14}/> New course</button></div></section>}
    {error && <div className="academy-alert error">{error}<button onClick={() => setError('')}><X size={14}/></button></div>}{message && <div className="academy-alert success">{message}<button onClick={() => setMessage('')}><X size={14}/></button></div>}
    {isAdmin && <div className="academy-filter-tabs">{(['published','all','draft','archived'] as const).map(x => <button key={x} className={filter === x ? 'selected' : ''} onClick={() => setFilter(x)}>{x.toUpperCase()}</button>)}</div>}
    {loading ? <div className="glass-panel academy-empty">Loading Academy content…</div> : visibleCourses.length === 0 ? <div className="glass-panel academy-empty"><BookOpen size={28}/><b>{isAdmin ? 'Belum ada course' : 'Materi segera tersedia'}</b><span>{isAdmin ? 'Buat course pertama untuk mulai menyusun kurikulum.' : 'Admin belum mempublikasikan materi.'}</span></div> : <>
      <div className="section-heading standalone"><div><span className="section-kicker">CURRICULUM</span><h2>Learning library</h2></div><span className="academy-count">{visibleCourses.length} COURSES</span></div>
      <div className="academy-course-layout">
        <aside className="glass-panel academy-course-list">{visibleCourses.map((item, i) => <button key={item.id} className={`academy-course-item ${selectedCourse === item.id ? 'selected' : ''}`} onClick={() => { setSelectedCourse(item.id); setSelectedChapter(null); setSelectedLesson(null) }}><span className="academy-course-number">{String(i + 1).padStart(2,'0')}</span><span><b>{item.title}</b><small>{item.level} · {chapters.filter(x => x.course_id === item.id && (isAdmin || x.status === 'published')).length} chapters</small></span><ChevronRight size={15}/></button>)}</aside>
        <div className="academy-content-column">
          {course && <section className="glass-panel academy-detail-panel"><div className="academy-detail-heading"><div><span className="section-kicker">COURSE / {course.level.toUpperCase()}</span><h2>{course.title}</h2><p>{course.description || 'Structured learning material from Veltrix Academy.'}</p></div>{isAdmin && <div className="academy-item-actions"><button title="Edit course" onClick={() => beginEdit('course', course)}><Pencil size={14}/></button><button title="Publish" onClick={() => void setStatus('course', course.id, 'published')}><Check size={14}/></button><button title="Archive" onClick={() => void setStatus('course', course.id, 'archived')}><Archive size={14}/></button><button title="Delete" onClick={() => void remove('course', course.id)}><Trash2 size={14}/></button></div>}</div>
            <div className="academy-chapter-head"><span className="section-kicker">CHAPTERS</span>{isAdmin && <button className="text-link" onClick={() => beginCreate('chapter', course.id)}><Plus size={14}/> Add chapter</button>}</div>
            {courseChapters.length === 0 ? <div className="academy-empty-inline">Belum ada bab yang dipublikasikan.</div> : <div className="academy-chapter-list">{courseChapters.map((item, i) => <button key={item.id} className={`academy-chapter-item ${selectedChapter === item.id ? 'selected' : ''}`} onClick={() => { setSelectedChapter(item.id); setSelectedLesson(null) }}><span>{String(i + 1).padStart(2,'0')}</span><b>{item.title}</b><ChevronDown size={14}/>{isAdmin && <span className="academy-mini-actions" onClick={e => e.stopPropagation()}><i onClick={() => beginEdit('chapter', item)} title="Edit chapter"><Pencil size={12}/></i><i onClick={() => void setStatus('chapter', item.id, item.status === 'published' ? 'draft' : 'published')} title="Toggle publish"><Check size={12}/></i><i onClick={() => void setStatus('chapter', item.id, 'archived')} title="Archive"><Archive size={12}/></i><i onClick={() => void remove('chapter', item.id)} title="Delete"><Trash2 size={12}/></i></span>}</button>)}</div>}
          </section>}
          {chapter && <section className="glass-panel academy-detail-panel"><div className="academy-chapter-head"><div><span className="section-kicker">SELECTED CHAPTER</span><h3>{chapter.title}</h3></div>{isAdmin && <button className="button button-outline" onClick={() => beginCreate('lesson', chapter.id)}><Plus size={13}/> Add lesson</button>}</div>
            <div className="academy-lesson-list">{chapterLessons.map((item, i) => <button key={item.id} className={`academy-lesson-item ${selectedLesson === item.id ? 'selected' : ''}`} onClick={() => setSelectedLesson(item.id)}><span>{String(i + 1).padStart(2,'0')}</span><span><b>{item.title}</b><small>{item.duration_minutes} min · {item.summary || 'Learning material'}</small></span><ArrowRight size={15}/></button>)}</div>
          </section>}
          {lesson && <article className="glass-panel academy-reading-panel"><div className="academy-reading-top"><span className="section-kicker">LESSON / {lesson.duration_minutes} MIN</span>{isAdmin && <div className="academy-item-actions"><button title="Edit lesson" onClick={() => beginEdit('lesson', lesson)}><Pencil size={14}/></button><button title="Publish" onClick={() => void setStatus('lesson', lesson.id, 'published')}><Check size={14}/></button><button title="Archive" onClick={() => void setStatus('lesson', lesson.id, 'archived')}><Archive size={14}/></button><button title="Delete" onClick={() => void remove('lesson', lesson.id)}><Trash2 size={14}/></button></div>}</div><h2>{lesson.title}</h2>{lesson.summary && <p className="academy-reading-summary">{lesson.summary}</p>}<div className="academy-reading-content">{lesson.content.split('\n').map((line, i) => <p key={i}>{line || '\u00a0'}</p>)}</div>
            <div className="academy-resources"><div className="academy-chapter-head"><span className="section-kicker">ATTACHMENTS & RESOURCES</span>{isAdmin && <label className="button button-outline academy-upload-button"><Upload size={13}/>{uploading ? 'Uploading…' : 'Upload file'}<input type="file" disabled={uploading} onChange={e => { void uploadResource(e.target.files?.[0]); e.currentTarget.value = '' }} /></label>}</div>{lessonResources.length === 0 ? <span className="muted small-text">Belum ada lampiran.</span> : lessonResources.map(resource => <div className="academy-resource-row" key={resource.id}><FileText size={15}/><span><b>{resource.file_name}</b><small>{resource.size_bytes ? `${(resource.size_bytes / 1024 / 1024).toFixed(2)} MB` : 'Attachment'}</small></span><button onClick={() => void openResource(resource)} title="Open file"><Download size={14}/></button>{isAdmin && <button onClick={() => void deleteResource(resource)} title="Delete file"><Trash2 size={14}/></button>}</div>)}</div>
          </article>}
          {!chapter && course && <div className="glass-panel academy-empty">Pilih bab untuk melihat materi.</div>}
        </div>
      </div>
    </>}
    {editor && <div className="academy-modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setEditor(null) }}><section className="glass-panel academy-editor-modal" role="dialog" aria-modal="true"><div className="panel-heading"><div><span className="section-kicker">CONTENT STUDIO / {editor.id ? 'EDIT' : 'CREATE'}</span><h3>{editor.id ? 'Edit' : 'New'} {editor.kind}</h3></div><button className="icon-button" onClick={() => setEditor(null)}><X size={17}/></button></div>
      <label className="academy-field">Title<input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Judul konten" /></label>
      {editor.kind === 'course' && <><label className="academy-field">Description<textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3}/></label><label className="academy-field">Level<select value={form.level} onChange={e => setForm({ ...form, level: e.target.value })}>{['Beginner','Intermediate','Advanced','All levels'].map(x => <option key={x}>{x}</option>)}</select></label></>}
      {editor.kind === 'chapter' && <label className="academy-field">Description<textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3}/></label>}
      {editor.kind === 'lesson' && <><label className="academy-field">Short description<input value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} placeholder="Ringkasan materi" /></label><label className="academy-field">Lesson content<textarea className="academy-content-input" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} rows={12} placeholder="Tulis penjelasan materi di sini. Pisahkan paragraf dengan baris baru."/></label><label className="academy-field">Duration (minutes)<input type="number" min="1" max="600" value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: Number(e.target.value) })}/></label></>}
      <label className="academy-field">Sort order<input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: Number(e.target.value) })}/></label><div className="academy-modal-actions"><button className="button button-outline" onClick={() => setEditor(null)}>Cancel</button><button className="button button-primary" disabled={saving} onClick={() => void save()}><Save size={14}/>{saving ? 'Saving…' : 'Save draft'}</button></div><p className="academy-modal-hint">Konten baru otomatis tersimpan sebagai draft. Publikasikan setelah siap.</p>
    </section></div>}
  </>
}
