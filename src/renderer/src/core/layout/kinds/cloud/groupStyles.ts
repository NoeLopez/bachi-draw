// Catálogo de estilos de los grupos contenedores (clusters) tipo Lucid/AWS.
//
// Cada tipo `aws/groups/<x>` declara su apariencia: color y estilo de borde,
// tinte de fondo e icono de esquina. El icono se resuelve con getOfficialIconUrl
// (los SVG ya existen bajo icons/aws/groups/). Los colores se aproximan a la
// guía oficial de AWS Architecture Icons (VPC verde, Region azul punteado,
// Account rosa, subnets verde/azul, auto-scaling naranja punteado…).
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
    borderColor: '#232F3E',
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
    borderColor: '#248823',
    fillColor: 'rgba(36, 136, 35, 0.04)',
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
    borderColor: '#5A6B86',
    fillColor: 'transparent',
    borderStyle: 'solid',
    icon: 'aws/groups/server-contents'
  },
  'aws/groups/corporate-data-center': {
    label: 'Corporate data center',
    borderColor: '#5A6B86',
    fillColor: 'rgba(90, 107, 134, 0.05)',
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
