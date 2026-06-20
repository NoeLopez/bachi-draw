import { type NodeProps } from '@xyflow/react'
import type { GroupNode as GroupNodeType } from '../../../core/layout/kinds/cloud/toReactFlow'
import { getGroupStyle } from '../../../core/layout/kinds/cloud/groupStyles'
import { getIconDataUri } from '../../../icons/registry'
import NodeLabelInput from './NodeLabelInput'

/**
 * Nodo contenedor (cluster). Si tiene `groupType` (ej. aws/groups/region), se
 * pinta con el estilo del catálogo (groupStyles.ts): icono de esquina, color y
 * trazo de borde y tinte de fondo — al estilo de Lucid/AWS. Sin tipo, conserva
 * el render base (borde punteado gris + label arriba a la izquierda).
 *
 * El interior es transparente a los eventos salvo el borde/cabecera, para que
 * los nodos hijos sigan siendo interactuables.
 */
export default function GroupNode({
  id,
  data,
  selected
}: NodeProps<GroupNodeType>): React.JSX.Element {
  const style = getGroupStyle(data.groupType)
  const cssVars = style
    ? ({
        '--group-border': style.borderColor,
        '--group-fill': style.fillColor,
        '--group-border-style': style.borderStyle
      } as React.CSSProperties)
    : undefined
  const iconUri = style ? getIconDataUri(style.icon) : undefined

  return (
    <div
      className={`bachi-draw-rf-group ${style ? 'is-styled' : ''} ${selected ? 'is-selected' : ''}`}
      style={cssVars}
    >
      <div className="bachi-draw-rf-group-header">
        {iconUri ? (
          <img className="bachi-draw-rf-group-icon" src={iconUri} alt="" draggable={false} />
        ) : null}
        {data.editing ? (
          <div className="bachi-draw-rf-group-label-wrap">
            <NodeLabelInput nodeId={id} initial={data.label} align="left" />
          </div>
        ) : (
          <div className="bachi-draw-rf-group-label">{data.label}</div>
        )}
      </div>
    </div>
  )
}
