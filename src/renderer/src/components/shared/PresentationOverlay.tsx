import { useEffect, useRef, useState } from 'react'

interface PresentationOverlayProps {
  /** Salir del modo presentación (lo dispara también el atajo Esc en App). */
  onExit: () => void
}

/**
 * Capa informativa del modo presentación. Muestra un aviso breve al entrar y un
 * hint discreto "Esc — salir" abajo a la derecha que se desvanece tras unos
 * segundos de inactividad y reaparece al mover el ratón. El hint sí es clicable
 * (alternativa a la tecla Esc); el aviso no captura eventos.
 */
export default function PresentationOverlay({
  onExit
}: PresentationOverlayProps): React.JSX.Element {
  const [toastVisible, setToastVisible] = useState(true)
  const [hintVisible, setHintVisible] = useState(true)
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // El aviso de entrada se desvanece solo a los ~2.5s.
  useEffect(() => {
    const t = setTimeout(() => setToastVisible(false), 2500)
    return () => clearTimeout(t)
  }, [])

  // El hint se oculta tras 3s sin mover el ratón y reaparece al moverlo.
  useEffect(() => {
    const arm = (): void => {
      if (hintTimer.current) clearTimeout(hintTimer.current)
      hintTimer.current = setTimeout(() => setHintVisible(false), 3000)
    }
    const onMove = (): void => {
      setHintVisible(true)
      arm()
    }
    arm()
    window.addEventListener('mousemove', onMove)
    return () => {
      window.removeEventListener('mousemove', onMove)
      if (hintTimer.current) clearTimeout(hintTimer.current)
    }
  }, [])

  return (
    <>
      {toastVisible ? (
        <div className="bachi-draw-presentation-toast" role="status">
          Modo presentación · <strong>Esc</strong> para salir
        </div>
      ) : null}
      <button
        type="button"
        className={`bachi-draw-presentation-hint${hintVisible ? '' : ' is-hidden'}`}
        onClick={onExit}
        title="Salir del modo presentación"
      >
        <kbd>Esc</kbd> salir
      </button>
    </>
  )
}
