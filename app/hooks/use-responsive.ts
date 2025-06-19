import { useEffect, useState } from 'react'

type BreakpointKey = 'sm' | 'md' | 'lg' | 'xl' | '2xl'

const breakpoints: Record<BreakpointKey, number> = {
	sm: 640,
	md: 768,
	lg: 1024,
	xl: 1280,
	'2xl': 1536
}

export function useBreakpoint(breakpointKey: BreakpointKey) {
	const [isAboveBreakpoint, setIsAboveBreakpoint] = useState(false)

	useEffect(() => {
		const mediaQuery = window.matchMedia(`(min-width: ${breakpoints[breakpointKey]}px)`)
		
		setIsAboveBreakpoint(mediaQuery.matches)

		const handleChange = (event: MediaQueryListEvent) => {
			setIsAboveBreakpoint(event.matches)
		}

		mediaQuery.addEventListener('change', handleChange)

		return () => {
			mediaQuery.removeEventListener('change', handleChange)
		}
	}, [breakpointKey])

	return isAboveBreakpoint
}

export function useResponsive() {
	const isSm = useBreakpoint('sm')
	const isMd = useBreakpoint('md')
	const isLg = useBreakpoint('lg')
	const isXl = useBreakpoint('xl')
	const is2xl = useBreakpoint('2xl')

	return {
		isMobile: !isSm,
		isTablet: isSm && !isMd,
		isDesktop: isMd,
		isLarge: isLg,
		isXl,
		is2xl,
		// Helpers
		isSm,
		isMd,
		isLg
	}
}
