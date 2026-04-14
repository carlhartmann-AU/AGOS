'use client'

import { useBrand } from '@/context/BrandContext'

export function BrandSelector() {
  const { brands, activeBrand, setActiveBrand } = useBrand()

  if (brands.length === 0) return null

  return (
    <div className="px-3 py-2">
      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
        Brand
      </label>
      <select
        value={activeBrand?.brand_id ?? ''}
        onChange={(e) => {
          const brand = brands.find((b) => b.brand_id === e.target.value)
          if (brand) setActiveBrand(brand)
        }}
        className="w-full bg-gray-800 text-white text-sm rounded-md px-2 py-1.5
                   border border-gray-700 focus:outline-none focus:ring-1
                   focus:ring-indigo-500 cursor-pointer"
      >
        {brands.map((b) => (
          <option key={b.brand_id} value={b.brand_id}>
            {b.name}
          </option>
        ))}
      </select>
    </div>
  )
}
