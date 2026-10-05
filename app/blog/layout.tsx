import {MarketingNavigation} from '@/components/marketing-navigation';
import {MarketingFooter} from '@/components/marketing-footer';
import '../marketing.css';
import './blog.css';
export default function BlogLayout({children}:{children:React.ReactNode}){return <div className="marketing blog-site"><a className="marketing-skip" href="#main">Skip to content</a><MarketingNavigation/>{children}<MarketingFooter/></div>;}
