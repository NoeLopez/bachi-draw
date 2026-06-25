// Catálogo de estilos de los grupos contenedores (clusters) tipo Lucid/AWS.
//
// Cada tipo `aws/groups/<x>` declara su apariencia: color y estilo de borde,
// tinte de fondo e icono de esquina. El icono se resuelve con getOfficialIconUrl
// (los SVG ya existen bajo icons/aws/groups/). El borderColor (que tiñe borde,
// label y, atenuado, el fondo) coincide con el color de fondo del SVG oficial del
// icono, para que todo el grupo sea cromáticamente coherente (VPC morado, Region
// azul punteado, Account rosa, subnets verde/azul, auto-scaling naranja…).
//
// Es el patrón a replicar cuando se añadan grupos de GCP/Azure: otro mapa con
// los tipos `gcp/groups/*`, sin tocar el resto del editor.

export interface GroupStyle {
  /** Etiqueta legible para el panel y el inspector. */
  label: string
  /** Color del borde (y del icono/label). */
  borderColor: string
  /** Tinte de fondo del contenedor (muy suave o 'transparent'). */
  fillColor: string
  /** Trazo del borde. */
  borderStyle: 'solid' | 'dashed'
  /** Tipo de icono de esquina (resuelto por getOfficialIconUrl). */
  icon: string
}

// Orden = orden de aparición en el panel "Grupos".
const GROUP_STYLES: Record<string, GroupStyle> = {
  'aws/groups/aws-cloud': {
    label: 'AWS Cloud',
    borderColor: '#242F3E',
    fillColor: 'transparent',
    borderStyle: 'solid',
    icon: 'aws/groups/aws-cloud'
  },
  'aws/groups/region': {
    label: 'Region',
    borderColor: '#00A4A6',
    fillColor: 'transparent',
    borderStyle: 'dashed',
    icon: 'aws/groups/region'
  },
  'aws/groups/virtual-private-cloud-vpc': {
    label: 'VPC',
    borderColor: '#8C4FFF',
    fillColor: 'rgba(140, 79, 255, 0.04)',
    borderStyle: 'solid',
    icon: 'aws/groups/virtual-private-cloud-vpc'
  },
  'aws/groups/public-subnet': {
    label: 'Public subnet',
    borderColor: '#7AA116',
    fillColor: 'rgba(122, 161, 22, 0.10)',
    borderStyle: 'solid',
    icon: 'aws/groups/public-subnet'
  },
  'aws/groups/private-subnet': {
    label: 'Private subnet',
    borderColor: '#00A4A6',
    fillColor: 'rgba(0, 164, 166, 0.10)',
    borderStyle: 'solid',
    icon: 'aws/groups/private-subnet'
  },
  'aws/groups/aws-account': {
    label: 'AWS Account',
    borderColor: '#E7157B',
    fillColor: 'transparent',
    borderStyle: 'solid',
    icon: 'aws/groups/aws-account'
  },
  'aws/groups/auto-scaling-group': {
    label: 'Auto Scaling group',
    borderColor: '#ED7100',
    fillColor: 'transparent',
    borderStyle: 'dashed',
    icon: 'aws/groups/auto-scaling-group'
  },
  'aws/groups/spot-fleet': {
    label: 'Spot Fleet',
    borderColor: '#ED7100',
    fillColor: 'transparent',
    borderStyle: 'solid',
    icon: 'aws/groups/spot-fleet'
  },
  'aws/groups/ec2-instance-contents': {
    label: 'EC2 instance contents',
    borderColor: '#ED7100',
    fillColor: 'transparent',
    borderStyle: 'solid',
    icon: 'aws/groups/ec2-instance-contents'
  },
  'aws/groups/server-contents': {
    label: 'Server contents',
    borderColor: '#7D8998',
    fillColor: 'transparent',
    borderStyle: 'solid',
    icon: 'aws/groups/server-contents'
  },
  'aws/groups/corporate-data-center': {
    label: 'Corporate data center',
    borderColor: '#7D8998',
    fillColor: 'rgba(125, 137, 152, 0.05)',
    borderStyle: 'solid',
    icon: 'aws/groups/corporate-data-center'
  },
  'aws/groups/aws-iot-greengrass-deployment': {
    label: 'IoT Greengrass deployment',
    borderColor: '#7AA116',
    fillColor: 'transparent',
    borderStyle: 'dashed',
    icon: 'aws/groups/aws-iot-greengrass-deployment'
  }
}

/** ¿Es `type` un tipo de grupo (borde de cluster)? */
export function isGroupType(type: string | undefined): boolean {
  return !!type && type.includes('/groups/')
}

/** Estilo de un tipo de grupo, o undefined si no está en el catálogo. */
export function getGroupStyle(type: string | undefined): GroupStyle | undefined {
  return type ? GROUP_STYLES[type] : undefined
}

/** Tipos de grupo disponibles, en orden de panel. */
export function listGroupTypes(): string[] {
  return Object.keys(GROUP_STYLES)
}

/** Tamaño por defecto de un grupo recién soltado en el lienzo. */
export function defaultGroupSize(): { width: number; height: number } {
  return { width: 280, height: 200 }
}
