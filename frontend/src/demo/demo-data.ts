import type { ContentItem, Creator } from "@/lib/patreon-tv/types"

const art = (name: string) => new URL(`./art/${name}.png`, import.meta.url).href

export const CREATORS: Creator[] = [
  {
    id: "cosmico",
    name: "Archivo Cósmico",
    tagline: "Ciencia, espacio y el universo explicado",
    avatar: art("creator-cosmic"),
    color: "gold",
  },
  {
    id: "nocturna",
    name: "Frecuencia Nocturna",
    tagline: "Entrevistas y relatos para la madrugada",
    avatar: art("creator-night"),
    color: "purple",
  },
  {
    id: "biblioteca",
    name: "La Biblioteca Secreta",
    tagline: "Misterio, novela negra y clubes de lectura",
    avatar: art("creator-library"),
    color: "green",
  },
  {
    id: "taller",
    name: "El Taller",
    tagline: "Arte, oficio y procesos creativos",
    avatar: art("creator-workshop"),
    color: "coral",
  },
]

export const CONTENT: ContentItem[] = [
  // Archivo Cósmico
  {
    id: "cos-1",
    creatorId: "cosmico",
    kind: "video",
    title: "El día que medimos la Vía Láctea",
    description:
      "Un repaso visual a las misiones que nos dieron la primera escala real de nuestra galaxia, desde Gaia hasta los telescopios terrestres.",
    publishedAt: "2026-10-06",
    durationSec: 624,
    art: art("gold"),
    color: "gold",
  },
  {
    id: "cos-2",
    creatorId: "cosmico",
    kind: "audio",
    title: "Agujeros negros para insomnes",
    description: "Una conversación relajada sobre horizontes de sucesos, spaghettification y por qué nada escapa, ni la luz.",
    publishedAt: "2026-10-02",
    durationSec: 2760,
    art: art("slate"),
    color: "slate",
  },
  {
    id: "cos-3",
    creatorId: "cosmico",
    kind: "text",
    title: "Notas de campo: el eclipse de abril",
    description:
      "Lo que vimos, lo que medimos y lo que salió mal durante la expedición de observación en el desierto. Incluye datos crudos del fotómetro portátil y las correcciones que tuvimos que aplicar sobre la marcha cuando las nubes bajas amenazaron la ventana de totalidad.",
    publishedAt: "2026-09-28",
    art: art("gold"),
    color: "gold",
  },
  {
    id: "cos-4",
    creatorId: "cosmico",
    kind: "video",
    title: "Simulando la formación planetaria",
    description: "Visitamos el laboratorio de dinámica orbital para ver cómo se construyen sistemas solares enteros en una supercomputadora.",
    publishedAt: "2026-09-20",
    durationSec: 842,
    art: art("slate"),
    color: "slate",
    locked: true,
  },
  {
    id: "cos-5",
    creatorId: "cosmico",
    kind: "audio",
    title: "Preguntas y respuestas de septiembre",
    description: "Respondemos lo que nos preguntaron este mes sobre cosmología, exoplanetas y el futuro de los viajes espaciales.",
    publishedAt: "2026-09-12",
    durationSec: 1980,
    art: art("gold"),
    color: "gold",
  },
  {
    id: "cos-6",
    creatorId: "cosmico",
    kind: "video",
    title: "Dentro del espejo primario",
    description: "Acceso exclusivo al pulido del espejo de 8 metros para el próximo observatorio terrestre de nueva generación.",
    publishedAt: "2026-08-30",
    durationSec: 511,
    art: art("slate"),
    color: "slate",
    locked: true,
  },

  // Frecuencia Nocturna
  {
    id: "noc-1",
    creatorId: "nocturna",
    kind: "audio",
    title: "Conversaciones a las 3 a.m.",
    description: "Una charla sin guion sobre insomnio, creatividad y las ideas que solo aparecen cuando todos duermen.",
    publishedAt: "2026-10-07",
    durationSec: 3120,
    art: art("purple"),
    color: "purple",
  },
  {
    id: "noc-2",
    creatorId: "nocturna",
    kind: "text",
    title: "Guion: el episodio que nunca salió al aire",
    description:
      "La transcripción completa de la grabación que se quedó en el cajón por casi dos años. Hoy por fin la compartimos sin editar, con todas las pausas incómodas y las risas fuera de lugar que la hacían tan especial para quienes estuvimos en el estudio esa noche.",
    publishedAt: "2026-10-01",
    art: art("coral"),
    color: "coral",
  },
  {
    id: "noc-3",
    creatorId: "nocturna",
    kind: "video",
    title: "Detrás del micrófono",
    description: "Un vistazo al estudio improvisado donde grabamos cada semana, con todo y los problemas técnicos de siempre.",
    publishedAt: "2026-09-24",
    durationSec: 398,
    art: art("purple"),
    color: "purple",
    locked: true,
  },
  {
    id: "noc-4",
    creatorId: "nocturna",
    kind: "audio",
    title: "Historias que nos contaron los oyentes",
    description: "Seleccionamos las mejores anécdotas que nos enviaron este mes y las leemos en voz alta, una por una.",
    publishedAt: "2026-09-15",
    durationSec: 2340,
    art: art("coral"),
    color: "coral",
  },

  // La Biblioteca Secreta
  {
    id: "bib-1",
    creatorId: "biblioteca",
    kind: "text",
    title: "Reseña: la última novela de Ibarra",
    description:
      "Un análisis capítulo por capítulo de la novela que todos están recomendando este otoño, con spoilers claramente marcados y una sección final dedicada por completo al giro de la tercera parte que nadie vio venir.",
    publishedAt: "2026-10-05",
    art: art("green"),
    color: "green",
  },
  {
    id: "bib-2",
    creatorId: "biblioteca",
    kind: "video",
    title: "El club de lectura en vivo",
    description: "Grabación completa de la sesión mensual donde discutimos el final más debatido del año.",
    publishedAt: "2026-09-29",
    durationSec: 1560,
    art: art("green"),
    color: "green",
    locked: true,
  },
  {
    id: "bib-3",
    creatorId: "biblioteca",
    kind: "audio",
    title: "Autores olvidados, vol. 3",
    description: "Rescatamos a tres escritoras de misterio de principios del siglo pasado que merecen mucho más reconocimiento.",
    publishedAt: "2026-09-18",
    durationSec: 2050,
    art: art("slate"),
    color: "slate",
  },
  {
    id: "bib-4",
    creatorId: "biblioteca",
    kind: "text",
    title: "Mapa de pistas: el caso sin resolver",
    description:
      "Reunimos todas las pistas dispersas a lo largo de la serie en un solo documento, con nuestras teorías y las de la comunidad.",
    publishedAt: "2026-09-09",
    art: art("green"),
    color: "green",
  },

  // El Taller
  {
    id: "tal-1",
    creatorId: "taller",
    kind: "video",
    title: "Encuadernación desde cero",
    description: "Paso a paso completo para encuadernar tu primer cuaderno en tapa dura, con lista de materiales incluida.",
    publishedAt: "2026-10-04",
    durationSec: 956,
    art: art("coral"),
    color: "coral",
  },
  {
    id: "tal-2",
    creatorId: "taller",
    kind: "audio",
    title: "Hablemos de bloqueos creativos",
    description: "Compartimos las técnicas que realmente nos han funcionado cuando el proyecto no avanza por ningún lado.",
    publishedAt: "2026-09-26",
    durationSec: 2490,
    art: art("purple"),
    color: "purple",
  },
  {
    id: "tal-3",
    creatorId: "taller",
    kind: "video",
    title: "Tour por el estudio renovado",
    description: "Después de meses de obra, por fin mostramos cómo quedó el nuevo espacio de trabajo.",
    publishedAt: "2026-09-14",
    durationSec: 487,
    art: art("coral"),
    color: "coral",
    locked: true,
  },
  {
    id: "tal-4",
    creatorId: "taller",
    kind: "text",
    title: "Diario de un encargo difícil",
    description:
      "Las notas honestas que tomé durante las seis semanas que me tomó terminar la pieza más complicada que me han pedido hasta ahora, incluyendo los dos intentos que tuve que desechar por completo.",
    publishedAt: "2026-08-31",
    art: art("purple"),
    color: "purple",
  },
]

export function creatorById(id: string) {
  return CREATORS.find((c) => c.id === id)
}

export function contentForCreator(creatorId: string) {
  return CONTENT.filter((c) => c.creatorId === creatorId).sort(
    (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
  )
}
