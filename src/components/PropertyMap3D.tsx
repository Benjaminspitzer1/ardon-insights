import { useEffect, useRef, useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Layers, MapPin, Building2, Trees, AlertTriangle, School, Coffee, TrendingUp } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

declare global {
  interface Window {
    google: typeof google
    initMap: () => void
  }
}

const LAYERS = [
  { id: 'satellite', label: 'Satellite', icon: MapPin, color: '#0D9488' },
  { id: 'transit', label: 'Transit', icon: MapPin, color: '#7C3AED' },
  { id: 'schools', label: 'Schools', icon: School, color: '#2563EB' },
  { id: 'amenities', label: 'Amenities', icon: Coffee, color: '#D97706' },
  { id: 'flood', label: 'Flood Zone', icon: AlertTriangle, color: '#DC2626' },
  { id: 'opportunity', label: 'Opportunity Zone', icon: TrendingUp, color: '#059669' },
  { id: 'heatmap', label: 'Rent Heatmap', icon: Layers, color: '#7C3AED' },
  { id: 'comps', label: 'Comps', icon: Building2, color: '#0D9488' },
] as const

type LayerId = typeof LAYERS[number]['id']

interface PropertyMap3DProps {
  propertyId: string
  lat: number
  lng: number
  propertyName: string
}

interface NeighborhoodScore {
  walk_score: number | null
  transit_score: number | null
  bike_score: number | null
  crime_index: number | null
  school_rating: number | null
  flood_zone: string | null
  opportunity_zone: boolean | null
}

export default function PropertyMap3D({ propertyId, lat, lng, propertyName }: PropertyMap3DProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const markerRef = useRef<google.maps.Marker | null>(null)
  const [activeLayers, setActiveLayers] = useState<Set<LayerId>>(new Set(['satellite']))
  const [mapLoaded, setMapLoaded] = useState(false)
  const [fetchingScore, setFetchingScore] = useState(false)

  const { data: neighborhoodScore, refetch: refetchScore } = useQuery<NeighborhoodScore | null>({
    queryKey: ['neighborhood-score', propertyId],
    queryFn: async () => {
      const { data } = await supabase
        .from('neighborhood_scores')
        .select('*')
        .eq('property_id', propertyId)
        .maybeSingle()
      return data
    },
  })

  // Load Google Maps script
  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      setMapLoaded(false)
      return
    }
    if (window.google?.maps) {
      setMapLoaded(true)
      return
    }
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=beta&map_ids=DEMO_MAP_ID&callback=initMap`
    script.async = true
    window.initMap = () => setMapLoaded(true)
    document.head.appendChild(script)
    return () => {
      document.head.removeChild(script)
    }
  }, [])

  // Initialize map
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || mapInstanceRef.current) return

    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat, lng },
      zoom: 16,
      mapTypeId: activeLayers.has('satellite') ? 'satellite' : 'roadmap',
      tilt: 45,
      heading: 0,
      mapId: 'DEMO_MAP_ID',
    })

    const marker = new window.google.maps.Marker({
      position: { lat, lng },
      map,
      title: propertyName,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#0D9488',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
      },
    })

    const infoWindow = new window.google.maps.InfoWindow({
      content: `<div style="color:#111;font-weight:600;padding:4px 8px">${propertyName}</div>`,
    })

    marker.addListener('click', () => infoWindow.open(map, marker))

    mapInstanceRef.current = map
    markerRef.current = marker
  }, [mapLoaded, lat, lng, propertyName])

  // Layer toggling
  const toggleLayer = useCallback((layerId: LayerId) => {
    setActiveLayers(prev => {
      const next = new Set(prev)
      next.has(layerId) ? next.delete(layerId) : next.add(layerId)

      const map = mapInstanceRef.current
      if (!map) return next

      // Toggle map type for satellite
      if (layerId === 'satellite') {
        map.setMapTypeId(next.has('satellite') ? 'satellite' : 'roadmap')
        map.setTilt(next.has('satellite') ? 45 : 0)
      }

      // Toggle transit layer
      if (layerId === 'transit') {
        const transitLayer = new window.google.maps.TransitLayer()
        transitLayer.setMap(next.has('transit') ? map : null)
      }

      return next
    })
  }, [])

  const fetchNeighborhoodScore = async () => {
    setFetchingScore(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/neighborhood-score`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ property_id: propertyId, lat, lng }),
      })
      refetchScore()
    } finally {
      setFetchingScore(false)
    }
  }

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

  return (
    <div className="space-y-4">
      {/* Layer controls */}
      <div className="flex flex-wrap gap-2">
        {LAYERS.map(({ id, label, icon: Icon, color }) => (
          <button
            key={id}
            onClick={() => toggleLayer(id)}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              activeLayers.has(id)
                ? 'border-transparent text-white'
                : 'border-border text-muted-foreground hover:border-brand-teal/40'
            )}
            style={activeLayers.has(id) ? { backgroundColor: color } : {}}
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        ))}
      </div>

      {/* Map container */}
      <Card className="overflow-hidden">
        <div className="relative">
          {!apiKey ? (
            <div className="flex h-96 flex-col items-center justify-center gap-3 bg-secondary/30">
              <MapPin className="h-12 w-12 text-muted-foreground/40" />
              <div className="text-center">
                <p className="font-medium">Google Maps API key not configured</p>
                <p className="text-sm text-muted-foreground">Add VITE_GOOGLE_MAPS_API_KEY to .env.local</p>
              </div>
              <div className="rounded-lg bg-card border border-border p-3 text-sm font-mono text-muted-foreground">
                {lat.toFixed(6)}, {lng.toFixed(6)}
              </div>
            </div>
          ) : (
            <div ref={mapRef} className="h-96 w-full" />
          )}
        </div>
      </Card>

      {/* Neighborhood Score Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Neighborhood Intelligence</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchNeighborhoodScore}
              disabled={fetchingScore}
            >
              {fetchingScore ? 'Fetching...' : neighborhoodScore ? 'Refresh' : 'Fetch Scores'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!neighborhoodScore ? (
            <p className="text-sm text-muted-foreground">
              Click "Fetch Scores" to pull Walk Score, crime index, school ratings, and flood zone data.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <ScoreCell label="Walk Score" value={neighborhoodScore.walk_score} max={100} unit="" />
              <ScoreCell label="Transit Score" value={neighborhoodScore.transit_score} max={100} unit="" />
              <ScoreCell label="Bike Score" value={neighborhoodScore.bike_score} max={100} unit="" />
              <ScoreCell label="School Rating" value={neighborhoodScore.school_rating} max={10} unit="/10" />
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Crime Index</p>
                <p className={cn('text-lg font-bold mt-1', (neighborhoodScore.crime_index ?? 100) < 50 ? 'text-emerald-400' : (neighborhoodScore.crime_index ?? 100) < 80 ? 'text-amber-400' : 'text-red-400')}>
                  {neighborhoodScore.crime_index?.toFixed(0) ?? '—'}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Flood Zone</p>
                <Badge variant={neighborhoodScore.flood_zone === 'X' ? 'success' : neighborhoodScore.flood_zone ? 'danger' : 'outline'} className="mt-1">
                  {neighborhoodScore.flood_zone ?? '—'}
                </Badge>
                {neighborhoodScore.opportunity_zone && (
                  <Badge variant="teal" className="mt-1 block w-fit">OZ</Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ScoreCell({ label, value, max, unit }: { label: string; value: number | null; max: number; unit: string }) {
  const pct = value !== null ? value / max : null
  const color = pct === null ? '' : pct >= 0.7 ? 'text-emerald-400' : pct >= 0.4 ? 'text-amber-400' : 'text-red-400'
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('text-lg font-bold mt-1', color)}>
        {value !== null ? `${value}${unit}` : '—'}
      </p>
    </div>
  )
}
