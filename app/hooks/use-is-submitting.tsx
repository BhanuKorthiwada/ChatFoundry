import { useNavigation, useFormAction } from 'react-router'

/**
 * Returns true if the current navigation is submitting the current route's
 * form. Defaults to the current route's form action and method POST.
 *
 * If GET, then this uses navigation.state === 'loading' instead of submitting.
 *
 * NOTE: the default formAction will include query params, but the
 * navigation.formAction will not, so don't use the default formAction if you
 * want to know if a form is submitting without specific query params.
 */
export function useIsSubmitting({
	formAction,
	formMethod = 'POST'
}: {
	formAction?: string
	formMethod?: 'POST' | 'GET' | 'PUT' | 'PATCH' | 'DELETE'
} = {}) {
	const contextualFormAction = useFormAction()
	const navigation = useNavigation()
	return (
		navigation.state === (formMethod === 'GET' ? 'loading' : 'submitting') &&
		navigation.formAction === (formAction ?? contextualFormAction) &&
		navigation.formMethod === formMethod
	)
}
