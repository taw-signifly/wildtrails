export function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
  
  if (diffInHours === 0) {
    return 'Just now'
  } else if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`
  } else if (diffInHours < 48) {
    return 'Yesterday'
  } else {
    const diffInDays = Math.floor(diffInHours / 24)
    return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`
  }
}