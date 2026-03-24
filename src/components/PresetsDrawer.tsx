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
              </div>
              <button
                type="button"
                className="chip"
                onClick={() => resetParams(activeVisualizerId)}
                style={{ marginTop: 8 }}
              >
                ↺ Сбросить параметры
              </button>
            </div>

            <div className="presets-drawer__section">
              <div className="presets-drawer__section-title">Сохранить пресет</div>
              <div className="presets-drawer__save-row">
                <input
                  type="text"
                  placeholder="Название"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  className="presets-drawer__input"
                />
                <button type="button" className="chip chip--accent" onClick={handleSave}>
                  Сохранить
                </button>
              </div>
            </div>

            {presetsForViz.length > 0 ? (
              <div className="presets-drawer__section">
                <div className="presets-drawer__section-title">Мои пресеты</div>
                <div className="presets-drawer__presets">
                  {presetsForViz.map((p) => (
                    <div key={p.id} className="preset-row">
                      <button type="button" className="preset-row__name" onClick={() => loadPreset(p)}>
                        {p.name}
                      </button>
                      <button
                        type="button"
                        className="preset-row__del"
                        onClick={() => deletePreset(p.id)}
                        aria-label="Удалить"
                        title="Удалить"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </aside>
  )
}
