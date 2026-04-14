'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { Brand } from '@/types'

type BrandContextValue = {
  brands: Brand[]
  activeBrand: Brand | null
  setActiveBrand: (brand: Brand) => void
}

const BrandContext = createContext<BrandContextValue>({
  brands: [],
  activeBrand: null,
  setActiveBrand: () => {},
})

export function BrandProvider({
  brands,
  children,
}: {
  brands: Brand[]
  children: React.ReactNode
}) {
  const [activeBrand, setActiveBrandState] = useState<Brand | null>(null)

  // Initialise from localStorage, then fall back to first brand
  useEffect(() => {
    if (brands.length === 0) return
    const stored = localStorage.getItem('agos_active_brand')
    const match = brands.find((b) => b.brand_id === stored)
    setActiveBrandState(match ?? brands[0])
  }, [brands])

  function setActiveBrand(brand: Brand) {
    localStorage.setItem('agos_active_brand', brand.brand_id)
    setActiveBrandState(brand)
  }

  return (
    <BrandContext.Provider value={{ brands, activeBrand, setActiveBrand }}>
      {children}
    </BrandContext.Provider>
  )
}

export function useBrand() {
  return useContext(BrandContext)
}
