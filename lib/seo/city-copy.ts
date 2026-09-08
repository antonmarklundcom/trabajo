// Editorial copy for the seven city landings (PLAN-GROWTH.md §4 S4).
// Plain data, not server-only. No invented numbers — nothing here states a
// count the site cannot itself back with a query result.
export const CITY_COPY: Record<string, string> = {
  asuncion:
    'Asunción concentra la mayor parte de la oferta laboral del país, con empresas de todos los ' +
    'rubros y sedes de bancos, aseguradoras y multinacionales. Hay vacantes tanto en el microcentro ' +
    'como en los barrios con mayor actividad comercial.',
  'ciudad-del-este': 'Ciudad del Este es el segundo polo económico de Paraguay, con fuerte actividad en comercio, importación y logística por su ubicación fronteriza. Las empresas de la zona suelen buscar perfiles de ventas, atención al cliente y logística.',
  encarnacion:
    'Encarnación combina comercio, turismo y agroindustria, con demanda de perfiles de atención al ' +
    'cliente, administración y ventas. La actividad crece especialmente en temporada alta por el ' +
    'turismo desde Argentina.',
  'san-lorenzo':
    'San Lorenzo, parte del Área Metropolitana de Asunción, tiene una oferta laboral diversa que ' +
    'incluye comercio, educación y servicios, con muchas vacantes también accesibles para quienes ' +
    'viven en la capital.',
  luque:
    'Luque combina industria, comercio y logística, con cercanía al Aeropuerto Internacional Silvio ' +
    'Pettirossi. Es una plaza con demanda constante de perfiles operativos y administrativos.',
  capiata:
    'Capiatá es una de las ciudades con mayor crecimiento del Área Metropolitana, con oferta ' +
    'laboral creciente en comercio, industria y servicios para quienes viven en la zona.',
  lambare:
    'Lambaré, sobre la ribera del río Paraguay y junto a Asunción, ofrece vacantes en comercio, ' +
    'servicios e industria, muchas de ellas también accesibles para quienes trabajan en la capital.',
};

export function cityCopyFor(slug: string): string | null {
  return CITY_COPY[slug] ?? null;
}
