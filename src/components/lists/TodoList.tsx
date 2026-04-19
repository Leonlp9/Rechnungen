import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TodoListData, TodoItem } from '@/store/listsStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, CheckSquare, Square, ImageIcon, XCircle } from 'lucide-react';
import { ImageLightbox } from './ImageLightbox';
import { ConfirmDialog } from './ConfirmDialog';

interface Props {
  data: TodoListData;
  onChange: (data: TodoListData) => void;
  listName: string;
}

function newId() {
  return `todo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  );
}

function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function TodoList({ data, onChange, listName }: Props) {
  const [input, setInput] = useState('');
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [burstId, setBurstId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ src: string; id: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const addItem = () => {
    const text = input.trim();
    if (!text && pendingImages.length === 0) return;
    const item: TodoItem = {
      id: newId(),
      text: text || '📷 Bild',
      done: false,
      createdAt: new Date().toISOString(),
      images: pendingImages.length ? pendingImages : undefined,
    };
    onChange({ items: [...data.items, item] });
    setInput('');
    setPendingImages([]);
    inputRef.current?.focus();
  };

  const handleInputPaste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
    const items = Array.from(e.clipboardData.items);
    const imgItem = items.find((it) => it.type.startsWith('image/'));
    if (!imgItem) return;
    e.preventDefault();
    const file = imgItem.getAsFile();
    if (!file) return;
    const src = await readImageFile(file);
    setPendingImages((prev) => [...prev, src]);
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const src = await readImageFile(file);
    setPendingImages((prev) => [...prev, src]);
    e.target.value = '';
  };

  const toggle = (id: string) => {
    const item = data.items.find((i) => i.id === id);
    if (item && !item.done) {
      setBurstId(id);
      setTimeout(() => setBurstId(null), 600);
    }
    onChange({
      items: data.items.map((i) =>
        i.id === id
          ? { ...i, done: !i.done, doneAt: !i.done ? new Date().toISOString() : undefined }
          : i
      ),
    });
  };

  const remove = (id: string) => {
    onChange({ items: data.items.filter((i) => i.id !== id) });
  };

  const pending = [...data.items.filter((i) => !i.done)].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const done = [...data.items.filter((i) => i.done)].sort(
    (a, b) => new Date(b.doneAt ?? b.createdAt).getTime() - new Date(a.doneAt ?? a.createdAt).getTime()
  );

  return (
    <>
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 shrink-0">
        <h2 className="text-xl font-semibold">{listName}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {pending.length} offen · {done.length} erledigt
        </p>
      </div>

      {/* Input */}
      <div className="px-6 py-3 border-b border-border shrink-0 space-y-2">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Neuer Eintrag… (Strg+V für Bilder)"
            onKeyDown={(e) => e.key === 'Enter' && addItem()}
            onPaste={handleInputPaste}
            className="flex-1"
          />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} title="Bild hinzufügen">
            <ImageIcon className="h-4 w-4" />
          </Button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileInput} />
          <Button onClick={addItem} size="sm">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {/* Pending image previews */}
        {pendingImages.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {pendingImages.map((src, i) => (
              <div key={i} className="relative group/img">
                <img src={src} alt="" className="h-14 w-14 object-cover rounded border" />
                <button
                  className="absolute -top-1 -right-1 text-destructive bg-background rounded-full opacity-0 group-hover/img:opacity-100 transition-opacity"
                  onClick={() => setPendingImages((prev) => prev.filter((_, j) => j !== i))}
                >
                  <XCircle className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
        {pending.length === 0 && done.length === 0 && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-muted-foreground text-sm mt-6 text-center"
          >
            Noch keine Einträge. Fang oben an!
          </motion.p>
        )}

        <AnimatePresence initial={false}>
          {pending.map((item) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, x: -20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.9, transition: { duration: 0.25 } }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="flex items-start gap-3 group rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors relative overflow-hidden"
            >
              {/* Burst overlay */}
              <AnimatePresence>
                {burstId === item.id && (
                  <motion.div
                    key="burst"
                    initial={{ scale: 0, opacity: 0.8 }}
                    animate={{ scale: 4, opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-primary/30 pointer-events-none"
                  />
                )}
              </AnimatePresence>

              <motion.button
                onClick={() => toggle(item.id)}
                whileTap={{ scale: 0.75, rotate: 10 }}
                whileHover={{ scale: 1.15 }}
                transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                className="shrink-0 text-muted-foreground hover:text-primary transition-colors relative z-10 mt-0.5"
              >
                <Square className="h-5 w-5" />
              </motion.button>
              <div className="flex-1 min-w-0 relative z-10">
                <span className="text-sm">{item.text}</span>
                {item.images && item.images.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {item.images.map((src, i) => {
                      const lid = `todo-img-${item.id}-${i}`;
                      return (
                        <motion.img
                          key={i}
                          layoutId={lid}
                          src={src}
                          alt=""
                          className="h-16 w-16 object-cover rounded border cursor-zoom-in hover:brightness-110 transition-all"
                          onClick={() => setLightbox({ src, id: lid })}
                        />
                      );
                    })}
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                  Erstellt: {formatDateTime(item.createdAt)}
                </p>
              </div>
              <button
                onClick={() => setConfirmDelete(item.id)}
                className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all relative z-10 mt-0.5"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        <AnimatePresence>
          {done.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="pt-4 pb-1"
            >
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Erledigt ({done.length})
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {done.map((item) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, x: 40, scale: 0.9 }}
              animate={{ opacity: 0.6, x: 0, scale: 1 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0, transition: { duration: 0.2 } }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="flex items-start gap-3 group rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors"
            >
              <motion.button
                onClick={() => toggle(item.id)}
                whileTap={{ scale: 0.75 }}
                whileHover={{ scale: 1.15 }}
                transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                className="shrink-0 text-primary transition-colors mt-0.5"
              >
                <CheckSquare className="h-5 w-5" />
              </motion.button>
              <div className="flex-1 min-w-0">
                <span className="text-sm line-through text-muted-foreground">{item.text}</span>
                {item.images && item.images.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {item.images.map((src, i) => {
                      const lid = `todo-img-done-${item.id}-${i}`;
                      return (
                        <motion.img
                          key={i}
                          layoutId={lid}
                          src={src}
                          alt=""
                          className="h-16 w-16 object-cover rounded border opacity-60 cursor-zoom-in hover:opacity-80 transition-all"
                          onClick={() => setLightbox({ src, id: lid })}
                        />
                      );
                    })}
                  </div>
                )}
                {item.doneAt && (
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                    Erledigt: {formatDateTime(item.doneAt)}
                  </p>
                )}
              </div>
              <button
                onClick={() => setConfirmDelete(item.id)}
                className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all mt-0.5"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
    <ImageLightbox
      src={lightbox?.src ?? null}
      layoutId={lightbox?.id ?? null}
      onClose={() => setLightbox(null)}
    />
    <ConfirmDialog
      open={confirmDelete !== null}
      title="Eintrag löschen?"
      description="Diesen Eintrag wirklich unwiderruflich löschen?"
      onConfirm={() => { if (confirmDelete) remove(confirmDelete); setConfirmDelete(null); }}
      onCancel={() => setConfirmDelete(null)}
    />
    </>
  );
}
