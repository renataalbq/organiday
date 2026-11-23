import Highlight from '@tiptap/extension-highlight'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { Placeholder } from '@tiptap/extensions'
import { EditorContent, useEditor, useEditorState, type Editor, type JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useRef, useState } from 'react'
import { useDayNote, useSaveDayNote } from '../data/dayNotes'

const SAVE_DELAY_MS = 800

type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

/** Notas do dia. Carrega a nota e só então monta o editor, para não piscar vazio. */
export function DayNotesEditor({ day }: { day: string }) {
  const note = useDayNote(day)

  if (note.isPending) return <p className="text-sm text-ink-faint">Carregando nota…</p>
  if (note.isError) return <NotesUnavailable error={note.error} onRetry={() => void note.refetch()} />

  // `key` recria o editor ao trocar de dia, com o conteúdo daquele dia
  return <NotesEditor key={day} day={day} initialContent={note.data} />
}

/** Erro do PostgREST quando a tabela não existe (migration 0003 não rodou). */
const isMissingTable = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'PGRST205'

function NotesUnavailable({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  if (isMissingTable(error)) {
    return (
      <div className="rounded-xl bg-peach/60 p-4 text-sm text-peach-ink">
        <p className="font-semibold">As notas ainda não estão ativadas no banco.</p>
        <p className="mt-1">
          No Supabase, abra <strong>SQL Editor → New query</strong>, cole o conteúdo de{' '}
          <code className="rounded bg-white/60 px-1">supabase/migrations/0003_day_notes.sql</code> e clique em{' '}
          <strong>Run</strong>. Depois toque em tentar de novo.
        </p>
        <button type="button" onClick={onRetry} className="button-quiet mt-2 -ml-3 text-peach-ink">
          Tentar de novo
        </button>
      </div>
    )
  }
  return (
    <div className="text-sm">
      <p className="font-semibold text-alert">Não deu pra carregar a nota.</p>
      <button type="button" onClick={onRetry} className="button-quiet mt-1 -ml-3">
        Tentar de novo
      </button>
    </div>
  )
}

function NotesEditor({ day, initialContent }: { day: string; initialContent: JSONContent | null }) {
  const saveDayNote = useSaveDayNote()
  const [status, setStatus] = useState<SaveStatus>('idle')
  const pendingContent = useRef<JSONContent | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const flush = useRef(async () => {
    window.clearTimeout(timer.current)
    const content = pendingContent.current
    if (!content) return
    pendingContent.current = null
    setStatus('saving')
    try {
      await saveDayNote(day, content)
      setStatus(pendingContent.current ? 'pending' : 'saved')
    } catch {
      pendingContent.current ??= content // tenta de novo na próxima edição
      setStatus('error')
    }
  })

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: false, autolink: true } }),
      Highlight,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: 'Anote o que quiser sobre o dia: ideias, combinados, links…' }),
    ],
    content: initialContent ?? '',
    editorProps: { attributes: { class: 'note-content', 'aria-label': 'Notas do dia' } },
    onUpdate: ({ editor }) => {
      pendingContent.current = editor.getJSON()
      setStatus('pending')
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => void flush.current(), SAVE_DELAY_MS)
    },
  })

  // salva o que faltou ao trocar de dia, sair da tela ou fechar a aba
  useEffect(() => {
    const flushNow = flush.current
    const onHide = () => document.visibilityState === 'hidden' && void flushNow()
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      void flushNow()
    }
  }, [])

  return (
    <div>
      <Toolbar editor={editor} />
      <EditorContent editor={editor} className="mt-3" />
      <p className="mt-3 h-4 text-right text-[11px] text-ink-faint" aria-live="polite">
        {STATUS_LABEL[status]}
      </p>
    </div>
  )
}

const STATUS_LABEL: Record<SaveStatus, string> = {
  idle: '',
  pending: 'Editando…',
  saving: 'Salvando…',
  saved: 'Salvo',
  error: 'Não deu pra salvar. Tentando de novo na próxima edição.',
}

// ─── Barra de formatação ──────────────────────────────────────────────────

const TOOL_ICONS = {
  bold: 'M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z',
  italic: 'M14 5h-4m4 14h-4m3-14-2 14',
  underline: 'M7 4v7a5 5 0 0 0 10 0V4M5 20h14',
  strike:
    'M4 12h16M16 6.5A4 3 0 0 0 12 5c-2.2 0-4 1.2-4 3 0 1.3 1 2.3 2.7 3M8 17.5A4 3 0 0 0 12 19c2.2 0 4-1.2 4-3 0-.7-.2-1.3-.7-1.8',
  highlight: 'm9 11-5 5v3h3l5-5m-3-3 6-6 3 3-6 6m-3-3 3 3M4 21h16',
  bulletList: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  orderedList: 'M10 6h10M10 12h10M10 18h10M4 4h1v4M4 8h2M4 14.5a1 1 0 0 1 2 0c0 .8-2 1.5-2 3.5h2',
  taskList: 'M3.5 5.5l1.5 1.5 2.5-2.5M3.5 11.5l1.5 1.5 2.5-2.5M4 17h3v3H4zM11 6h9M11 12h9M11 18.5h9',
  code: 'm8 8-4 4 4 4m8-8 4 4-4 4m-2.5-11-3 14',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
} as const

function Toolbar({ editor }: { editor: Editor }) {
  const active = useEditorState({
    editor,
    selector: ({ editor }) => ({
      h2: editor.isActive('heading', { level: 2 }),
      h3: editor.isActive('heading', { level: 3 }),
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      underline: editor.isActive('underline'),
      strike: editor.isActive('strike'),
      highlight: editor.isActive('highlight'),
      bulletList: editor.isActive('bulletList'),
      orderedList: editor.isActive('orderedList'),
      taskList: editor.isActive('taskList'),
      codeBlock: editor.isActive('codeBlock'),
      link: editor.isActive('link'),
    }),
  })

  const chain = () => editor.chain().focus()

  const toggleLink = () => {
    if (active.link) {
      chain().extendMarkRange('link').unsetLink().run()
      return
    }
    const url = window.prompt('Link (URL):', 'https://')
    if (!url || url === 'https://') return
    chain().extendMarkRange('link').setLink({ href: url }).run()
  }

  return (
    <div
      role="toolbar"
      aria-label="Formatação"
      className="flex flex-wrap items-center gap-0.5 rounded-xl border border-line bg-paper p-1"
    >
      <TextTool label="Título" text="H2" active={active.h2} onClick={() => chain().toggleHeading({ level: 2 }).run()} />
      <TextTool
        label="Subtítulo"
        text="H3"
        active={active.h3}
        onClick={() => chain().toggleHeading({ level: 3 }).run()}
      />
      <Divider />
      <IconTool label="Negrito" icon="bold" active={active.bold} onClick={() => chain().toggleBold().run()} />
      <IconTool label="Itálico" icon="italic" active={active.italic} onClick={() => chain().toggleItalic().run()} />
      <IconTool
        label="Sublinhado"
        icon="underline"
        active={active.underline}
        onClick={() => chain().toggleUnderline().run()}
      />
      <IconTool label="Tachado" icon="strike" active={active.strike} onClick={() => chain().toggleStrike().run()} />
      <IconTool
        label="Marca-texto"
        icon="highlight"
        active={active.highlight}
        onClick={() => chain().toggleHighlight().run()}
      />
      <Divider />
      <IconTool
        label="Lista"
        icon="bulletList"
        active={active.bulletList}
        onClick={() => chain().toggleBulletList().run()}
      />
      <IconTool
        label="Lista numerada"
        icon="orderedList"
        active={active.orderedList}
        onClick={() => chain().toggleOrderedList().run()}
      />
      <IconTool
        label="Checklist"
        icon="taskList"
        active={active.taskList}
        onClick={() => chain().toggleTaskList().run()}
      />
      <Divider />
      <IconTool
        label="Bloco de código"
        icon="code"
        active={active.codeBlock}
        onClick={() => chain().toggleCodeBlock().run()}
      />
      <IconTool label={active.link ? 'Remover link' : 'Link'} icon="link" active={active.link} onClick={toggleLink} />
    </div>
  )
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px bg-line" aria-hidden="true" />
}

const toolClass = (active: boolean) =>
  `grid h-8 min-w-8 place-items-center rounded-lg px-1.5 transition-colors ${
    active ? 'bg-lilac text-lilac-ink' : 'text-ink-soft hover:bg-black/5 hover:text-ink'
  }`

interface ToolProps {
  label: string
  active: boolean
  onClick: () => void
}

function IconTool({ label, icon, active, onClick }: ToolProps & { icon: keyof typeof TOOL_ICONS }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={toolClass(active)}
    >
      <svg
        width={17}
        height={17}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={TOOL_ICONS[icon]} />
      </svg>
    </button>
  )
}

function TextTool({ label, text, active, onClick }: ToolProps & { text: string }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`${toolClass(active)} text-xs font-bold`}
    >
      {text}
    </button>
  )
}
