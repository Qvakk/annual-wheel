/**
 * Holiday Service
 * Fetches public holidays from Nager.Date API (https://date.nager.at)
 * Free, reliable, and supports many countries
 */

/**
 * Public holiday from Nager.Date API
 */
export interface NagerHoliday {
  date: string; // ISO date format YYYY-MM-DD
  localName: string;
  name: string;
  countryCode: string;
  fixed: boolean;
  global: boolean;
  counties: string[] | null;
  launchYear: number | null;
  types: ('Public' | 'Bank' | 'School' | 'Authorities' | 'Optional' | 'Observance')[];
}

/**
 * Supported country for holiday calendars
 */
export interface HolidayCountry {
  code: string;
  name: string;
  nameLocal?: string;
}

/**
 * List of popular/supported countries
 * Full list available at: https://date.nager.at/api/v3/AvailableCountries
 */
export const supportedCountries: HolidayCountry[] = [
  { code: 'NO', name: 'Norway', nameLocal: 'Norge' },
  { code: 'SE', name: 'Sweden', nameLocal: 'Sverige' },
  { code: 'DK', name: 'Denmark', nameLocal: 'Danmark' },
  { code: 'FI', name: 'Finland', nameLocal: 'Suomi' },
  { code: 'IS', name: 'Iceland', nameLocal: 'Ísland' },
  { code: 'DE', name: 'Germany', nameLocal: 'Deutschland' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
  { code: 'FR', name: 'France' },
  { code: 'ES', name: 'Spain', nameLocal: 'España' },
  { code: 'IT', name: 'Italy', nameLocal: 'Italia' },
  { code: 'NL', name: 'Netherlands', nameLocal: 'Nederland' },
  { code: 'BE', name: 'Belgium', nameLocal: 'België' },
  { code: 'AT', name: 'Austria', nameLocal: 'Österreich' },
  { code: 'CH', name: 'Switzerland', nameLocal: 'Schweiz' },
  { code: 'PL', name: 'Poland', nameLocal: 'Polska' },
  { code: 'PT', name: 'Portugal' },
  { code: 'IE', name: 'Ireland' },
  { code: 'CZ', name: 'Czech Republic', nameLocal: 'Česká republika' },
  { code: 'AU', name: 'Australia' },
  { code: 'CA', name: 'Canada' },
  { code: 'JP', name: 'Japan', nameLocal: '日本' },
];

/**
 * Normalized holiday format for the app
 */
export interface PublicHoliday {
  id: string;
  date: Date;
  name: string;
  localName: string;
  countryCode: string;
  isNational: boolean; // true if it's a public/bank holiday
  types: string[];
}

// Cache for fetched holidays
const holidayCache = new Map<string, { holidays: PublicHoliday[]; fetchedAt: Date }>();
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get cache key for country+year
 */
function getCacheKey(countryCode: string, year: number): string {
  return `${countryCode}-${year}`;
}

/**
 * Fetch public holidays from Nager.Date API
 * @param countryCode - ISO 3166-1 alpha-2 country code (e.g., 'NO', 'SE', 'US')
 * @param year - The year to fetch holidays for
 * @returns Array of public holidays
 */
export async function fetchPublicHolidays(
  countryCode: string,
  year: number
): Promise<PublicHoliday[]> {
  const cacheKey = getCacheKey(countryCode, year);
  
  // Check cache first
  const cached = holidayCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt.getTime() < CACHE_DURATION_MS) {
    return cached.holidays;
  }

  try {
    const response = await fetch(
      `https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode.toUpperCase()}`
    );

    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`No holidays found for country ${countryCode} in year ${year}`);
        return [];
      }
      throw new Error(`Failed to fetch holidays: ${response.status} ${response.statusText}`);
    }

    const nagerHolidays: NagerHoliday[] = await response.json();

    // Transform to our format
    const holidays: PublicHoliday[] = nagerHolidays.map((h, index) => ({
      id: `${countryCode.toLowerCase()}-${year}-${index}`,
      date: new Date(h.date),
      name: h.name,
      localName: h.localName,
      countryCode: h.countryCode,
      isNational: h.global && (h.types.includes('Public') || h.types.includes('Bank')),
      types: h.types,
    }));

    // Cache the result
    holidayCache.set(cacheKey, { holidays, fetchedAt: new Date() });

    return holidays;
  } catch (error) {
    console.error(`Error fetching holidays for ${countryCode}:`, error);
    
    // Return cached data if available (even if stale)
    if (cached) {
      console.log('Returning stale cached data');
      return cached.holidays;
    }
    
    throw error;
  }
}

/**
 * Fetch holidays for multiple years (useful for year transitions)
 */
export async function fetchHolidaysForYears(
  countryCode: string,
  years: number[]
): Promise<PublicHoliday[]> {
  const results = await Promise.all(
    years.map(year => fetchPublicHolidays(countryCode, year))
  );
  return results.flat();
}

/**
 * Get holidays for the current year and optionally surrounding years
 */
export async function getHolidaysForCurrentPeriod(
  countryCode: string,
  includeNextYear: boolean = true
): Promise<PublicHoliday[]> {
  const currentYear = new Date().getFullYear();
  const years = includeNextYear ? [currentYear, currentYear + 1] : [currentYear];
  return fetchHolidaysForYears(countryCode, years);
}

/**
 * Get available countries from API
 */
export async function fetchAvailableCountries(): Promise<HolidayCountry[]> {
  try {
    const response = await fetch('https://date.nager.at/api/v3/AvailableCountries');
    if (!response.ok) {
      throw new Error('Failed to fetch available countries');
    }
    const countries: { countryCode: string; name: string }[] = await response.json();
    return countries.map(c => ({
      code: c.countryCode,
      name: c.name,
    }));
  } catch (error) {
    console.error('Error fetching available countries:', error);
    // Return our predefined list as fallback
    return supportedCountries;
  }
}

/**
 * Check if a date is a holiday in the given country
 */
export function isHoliday(
  date: Date,
  holidays: PublicHoliday[]
): PublicHoliday | undefined {
  const dateStr = date.toISOString().split('T')[0];
  return holidays.find(h => h.date.toISOString().split('T')[0] === dateStr);
}

/**
 * Get the country name by code
 */
export function getCountryName(countryCode: string): string {
  const country = supportedCountries.find(c => c.code === countryCode);
  return country?.name || countryCode;
}

/**
 * Get the local country name by code
 */
export function getCountryLocalName(countryCode: string): string | undefined {
  const country = supportedCountries.find(c => c.code === countryCode);
  return country?.nameLocal;
}

/**
 * Clear the holiday cache (useful for testing or forcing refresh)
 */
export function clearHolidayCache(): void {
  holidayCache.clear();
}

/**
 * Preload holidays for common countries (can be called on app init)
 */
export async function preloadCommonHolidays(
  countryCodes: string[] = ['NO']
): Promise<void> {
  const currentYear = new Date().getFullYear();
  await Promise.all(
    countryCodes.flatMap(code => [
      fetchPublicHolidays(code, currentYear),
      fetchPublicHolidays(code, currentYear + 1),
    ])
  );
}
