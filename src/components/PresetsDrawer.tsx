import { type ChangeEvent, useState } from 'react'
import { usePresetsStore, type ParamSchema, type ParamValue } from '../presets/presetsStore'
import { PARAM_SCHEMAS } from '../presets/paramSchemas'

export function PresetsDrawer() {
  const isOpen = usePresetsStore((s) => s.isDrawerOpen)
  const closeDrawer = usePresetsStore((s) => s.closeDrawer)
  const activeVisualizerId = usePresetsStore((s) => s.activeVisualizerId)
  const currentParams = usePresetsStore((s) => s.currentParams)
  const setParam = usePresetsStore((s) => s.setParam)
  const resetParams = usePresetsStore((s) => s.resetParams)
  const savedPresets = usePresetsStore((s) => s.savedPresets)
  const savePreset = usePresetsStore((s) => s.savePreset)
  const loadPreset = usePresetsStore((s) => s.loadPreset)
  const deletePreset = usePresetsStore((s) => s.deletePreset)

  const [presetName, setPresetName] = useState('')

  const schema = PARAM_SCHEMAS[activeVisualizerId] as ParamSchema[] | undefined
  const hasSchema = Array.isArray(schema) && schema.length > 0
  const values = currentParams[activeVisualizerId] ?? {}
  const presetsForViz = savedPresets.filter((p) => p.visualizerId === activeVisualizerId)

  function handleSave() {
    const name = presetName.trim()
    if (!name || !activeVisualizerId) return
    savePreset(name, activeVisualizerId)
    setPresetName('')
  }

  return (
    <aside className={`presets-drawer${isOpen ? ' presets-drawer--open' : ''}`} aria-hidden={!isOpen}>
      <header className="presets-drawer__header">
        <span className="presets-drawer__title">Параметры</span>
        <button type="button" className="ctrl ctrl--small" onClick={closeDrawer} aria-label="Закрыть">✕</button>
      </header>

      <div className="presets-drawer__body">
        {!activeVisualizerId ? (
          <p className="presets-drawer__empty">Выбери визуализатор в сайдбаре</p>
        ) : !hasSchema ? (
          <p className="presets-drawer__empty">У этого визуализатора пока нет настраиваемых параметров</p>
        ) : (
          <>
            <div className="presets-drawer__section">
              <div className="presets-drawer__section-title">{`Параметры · ${activeVisualizerId}`}</div>
              <div className="presets-drawer__params">
                {schema!.map((p) => (
                  <ParamControl
                    key={p.id}
                    schema={p}
                    value={values[p.id] ?? p.default}
                    onChange={(v) => setParam(activeVisualizerId, p.id, v)}
                  />
                ))}
}}
))
