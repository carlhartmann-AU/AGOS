'use client'

import { useState, useEffect, useRef } from 'react'
import { useBrand } from '@/context/BrandContext'

interface ProductVariant {
  id: string
  price: number | null
  currency: string | null
  inventory_quantity: number | null
}

export interface PickedProduct {
  id: string
  title: string
  status: string
  featured_image_url: string | null
  product_variants: ProductVariant[]
}

interface Props {
  value: PickedProduct | null
  onChange: (product: PickedProduct | null) => void
  placeholder?: string
  disabled?: boolean
}

export function ProductPicker({ value, onChange, placeholder = 'Select a product…', disabled }: Props) {
  const { activeBrand } = useBrand()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [products, setProducts] = useState<PickedProduct[]>([])
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const controller = new AbortController()
    const load = async () => {
      if (!activeBrand) return
      setLoading(true)
      try {
        const params = new URLSearchParams({
          brand_id: activeBrand.brand_id,
          status: 'active',
          limit: '50',
        })
        if (search) params.set('search', search)
        const res = await fetch(`/api/products?${params}`, { signal: controller.signal })
        if (res.ok) {
          const data = await res.json() as { products: PickedProduct[] }
          setProducts(data.products)
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setProducts([])
      } finally {
        setLoading(false)
      }
    }

    const timeout = setTimeout(load, search ? 300 : 0)
    return () => { clearTimeout(timeout); controller.abort() }
  }, [open, search, activeBrand?.brand_id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  function selectProduct(product: PickedProduct) {
    onChange(product)
    setOpen(false)
    setSearch('')
  }

  function clearSelection() {
    onChange(null)
    setOpen(false)
    setSearch('')
  }

  const priceDisplay = (variants: ProductVariant[]) => {
    const prices = variants.map(v => v.price ?? 0).filter(p => p > 0)
    if (!prices.length) return null
    const currency = variants[0]?.currency ?? 'AUD'
    const min = Math.min(...prices)
    const fmt = (n: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency }).format(n)
    return fmt(min)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        className="w-full flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm text-left
                   hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900
                   disabled:bg-gray-50 disabled:cursor-not-allowed transition"
      >
        {value ? (
          <>
            {value.featured_image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={value.featured_image_url} alt={value.title} className="w-6 h-6 rounded object-cover border border-gray-100 shrink-0" />
            )}
            <span className="flex-1 truncate text-gray-900">{value.title}</span>
            <span
              role="button"
              tabIndex={0}
              onClick={e => { e.stopPropagation(); clearSelection() }}
              onKeyDown={e => e.key === 'Enter' && clearSelection()}
              className="ml-1 text-gray-300 hover:text-gray-500 cursor-pointer"
              aria-label="Clear selection"
            >
              ✕
            </span>
          </>
        ) : (
          <span className="text-gray-400 flex-1">{placeholder}</span>
        )}
        <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-lg border border-gray-200 shadow-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100">
            <input
              type="text"
              autoFocus
              placeholder="Search products…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full text-sm focus:outline-none placeholder:text-gray-300"
            />
          </div>

          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="px-3 py-4 text-center text-xs text-gray-400">Loading…</div>
            ) : products.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-gray-400">
                {search ? 'No products match your search.' : 'No active products found.'}
              </div>
            ) : (
              products.map(product => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => selectProduct(product)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 transition-colors"
                >
                  {product.featured_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={product.featured_image_url} alt={product.title} className="w-8 h-8 rounded object-cover border border-gray-100 shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded bg-gray-100 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-900 truncate">{product.title}</div>
                    {priceDisplay(product.product_variants) && (
                      <div className="text-xs text-gray-400">From {priceDisplay(product.product_variants)}</div>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
