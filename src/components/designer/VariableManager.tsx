import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { TemplateVariable } from '@/types/template';
import { Plus, Trash2 } from 'lucide-react';

// Sentinel – Radix SelectItem crashes on value=""
const NO_SETTINGS_KEY = '__none__';

const SETTINGS_KEYS = [
  { value: NO_SETTINGS_KEY, label: '– Keine –' },
  { value: 'profile_name', label: 'Ihr Name / Firma' },
  { value: 'profile_address', label: 'Ihre Adresse' },
  { value: 'profile_email', label: 'E-Mail' },
  { value: 'profile_phone', label: 'Telefon' },
  { value: 'profile_tax_number', label: 'Steuernummer' },
  { value: 'profile_w_idnr', label: 'W-IdNr. (Wirtschafts-Identifikationsnummer)' },
  { value: 'profile_vat_id', label: 'USt-IdNr.' },
  { value: 'profile_finanzamt', label: 'Finanzamt' },
  { value: 'profile_iban', label: 'IBAN' },
  { value: 'profile_bic', label: 'BIC' },
  { value: 'profile_business_type', label: 'Branche / Tätigkeit' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  variables: TemplateVariable[];
  onChange: (vars: TemplateVariable[]) => void;
}

export function VariableManager({ open, onClose, variables, onChange }: Props) {
  const [vars, setVars] = useState<TemplateVariable[]>(variables);

  const add = () => {
    setVars((v) => [...v, { key: `var_${Date.now()}`, label: 'Neue Variable', defaultValue: '', settingsKey: '', multiline: false }]);
  };

  const update = (idx: number, patch: Partial<TemplateVariable>) => {
    setVars((v) => v.map((x, i) => i === idx ? { ...x, ...patch } : x));
  };

  const remove = (idx: number) => {
    setVars((v) => v.filter((_, i) => i !== idx));
  };

  const save = () => { onChange(vars); onClose(); };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Variablen verwalten</DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 space-y-3 pr-1">
          {vars.map((v, i) => (
            <div key={i} className="border border-border rounded-lg p-3 space-y-2 bg-muted/20">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Schlüssel</Label>
                  <Input value={v.key} onChange={(e) => update(i, { key: e.target.value })} className="h-8 text-xs font-mono" placeholder="mein_key" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Bezeichnung (im Formular)</Label>
                  <Input value={v.label} onChange={(e) => update(i, { label: e.target.value })} className="h-8 text-xs" placeholder="Mein Feld" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Standardwert</Label>
                  <Input value={v.defaultValue} onChange={(e) => update(i, { defaultValue: e.target.value })} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Aus Einstellungen vorausfüllen</Label>
                  <Select
                  value={v.settingsKey || NO_SETTINGS_KEY}
                  onValueChange={(val) => update(i, { settingsKey: val === NO_SETTINGS_KEY ? '' : val })}
                >
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SETTINGS_KEYS.map((sk) => (
                        <SelectItem key={sk.value} value={sk.value}>{sk.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={v.multiline} onChange={(e) => update(i, { multiline: e.target.checked })} />
                  Mehrzeilige Eingabe
                </label>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(i)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={add} className="w-full">
            <Plus className="mr-2 h-4 w-4" /> Variable hinzufügen
          </Button>
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t">
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={save}>Speichern</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}



