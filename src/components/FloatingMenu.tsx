
import React, { useState, useRef, useEffect } from 'react';
import { Star, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/auth';
import { supabase } from '@/integrations/supabase/client';
import { DynamicIcon } from '@/components/ui/dynamic-icon';

interface GalaxyItem {
  id: string;
  name: string;
  baseline: string;
  link: string;
  icon: string | React.ReactNode;
  color: string | null;
  icon_fg?: string | null;
  is_external: boolean;
  position: number;
}

const IconOrDynamic = ({
  icon,
  size = 20,
  className = '',
  color,
}: {
  icon: string | React.ReactNode;
  size?: number;
  className?: string;
  color?: string;
}) => {
  const sanitizeSvg = (raw: string): string => {
    let svg = raw;
    // Replace fill values except 'none' with currentColor
    svg = svg.replace(/fill=("|')(?!none)([^"']*)(\1)/gi, 'fill="currentColor"');
    // Replace stroke values except 'none' with currentColor
    svg = svg.replace(/stroke=("|')(?!none)([^"']*)(\1)/gi, 'stroke="currentColor"');
    // Also normalize CSS style attributes
    svg = svg.replace(/style=("|')(.*?)\1/gi, (_m, q, content) => {
      const updated = content
        .replace(/fill:\s*(?!none)[^;"']+/gi, 'fill: currentColor')
        .replace(/stroke:\s*(?!none)[^;"']+/gi, 'stroke: currentColor');
      return `style=${q}${updated}${q}`;
    });
    return svg;
  };

  if (React.isValidElement(icon)) {
    return React.cloneElement(icon as React.ReactElement, {
      width: size,
      height: size,
      className,
      color,
      fill: color,
      style: { color },
    });
  }

  if (typeof icon === 'string') {
    const trimmed = icon.trim();
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed?.type === 'svg' && typeof parsed.svg === 'string') {
          const fgColor = typeof parsed.fg === 'string' ? parsed.fg : color;
          return (
            <span
              className={`inline-grid place-items-center [&>svg]:block [&>svg]:w-full [&>svg]:h-full [&>svg]:max-w-full [&>svg]:max-h-full [&>svg]:fill-current [&>svg]:stroke-current [&_*]:fill-current [&_*]:stroke-current ${className}`}
              style={{ width: `${size}px`, height: `${size}px`, color: fgColor }}
              dangerouslySetInnerHTML={{ __html: sanitizeSvg(parsed.svg.trim()) }}
            />
          );
        }
      } catch (e) {
        // ignore JSON parse errors
      }
    }
    if (trimmed.startsWith('<svg')) {
      return (
        <span
          className={`inline-grid place-items-center [&>svg]:block [&>svg]:w-full [&>svg]:h-full [&>svg]:max-w-full [&>svg]:max-h-full [&>svg]:fill-current [&>svg]:stroke-current [&_*]:fill-current [&_*]:stroke-current ${className}`}
          style={{ width: `${size}px`, height: `${size}px`, color }}
          dangerouslySetInnerHTML={{ __html: sanitizeSvg(trimmed) }}
        />
      );
    }
    return <DynamicIcon name={icon} size={size} className={className} color={color} />;
  }

  return <DynamicIcon size={size} className={className} color={color} />;
};

const FloatingMenu = () => {
  const { user } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [menuItems, setMenuItems] = useState<GalaxyItem[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const withAlpha = (hexColor: string, alpha: number): string => {
    const fallback = '#f0fdf4';
    if (!hexColor) return fallback + '33';
    let h = hexColor.trim();
    if (!h.startsWith('#')) return hexColor; // Not a hex color, return as-is
    if (h.length === 4) {
      h = `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
    }
    if (h.length === 7) {
      const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255);
      const aa = a.toString(16).padStart(2, '0');
      return h + aa;
    }
    return h; // Already has alpha or unexpected format
  };

  useEffect(() => {
    if (user) {
      fetchMenuItems();
    }
  }, [user]);

  if (!user) {
    return null;
  }

  const fetchMenuItems = async () => {
    try {
      const { data, error } = await supabase
        .from('galaxy_items')
        .select('*')
        .eq('status', 'active')
        .order('position');

      if (error) throw error;

      setMenuItems(data || []);
    } catch (error) {
      console.error('Error fetching galaxy items:', error);
      // Fallback vers les éléments par défaut en cas d'erreur
      setMenuItems([]);
    }
  };

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsExpanded(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsExpanded(false);
    }, 300); // Délai de 300ms pour permettre de cliquer
  };

  if (menuItems.length === 0) {
    return null;
  }

  return (
    <div 
      className="fixed bottom-6 left-6 z-50"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Menu items - apparaissent au survol */}
      <div className={`
        absolute bottom-20 left-0 space-y-3 transition-all duration-300 ease-out
        ${isExpanded 
          ? 'opacity-100 translate-y-0 pointer-events-auto' 
          : 'opacity-0 translate-y-4 pointer-events-none'
        }
      `}>
        {menuItems.map((item, index) => (
          <div
            key={item.id}
            className={`
              transform transition-all duration-300 ease-out
              ${isExpanded 
                ? 'translate-x-0 opacity-100' 
                : '-translate-x-4 opacity-0'
              }
            `}
            style={{ 
              transitionDelay: isExpanded ? `${index * 50}ms` : '0ms' 
            }}
          >
            {item.is_external ? (
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-3 bg-white hover:bg-[var(--hover-bg)] p-3 rounded-lg shadow-lg border border-gray-200 transition-colors group min-w-48`}
                style={{ ...( { ['--hover-bg']: withAlpha(item.color || '#22c55e', 0.2) } as React.CSSProperties & Record<string, string | number>) }}
              >
                <div 
                  className="p-4 rounded-lg group-hover:text-white group-hover:[text-shadow:0_1px_2px_rgba(0,0,0,0.45)] transition-opacity"
                  style={{ backgroundColor: item.color || '#22c55e', color: item.icon_fg || '#ffffff' }}
                >
                  <IconOrDynamic icon={item.icon} size={30} />
                </div>
                <div className="flex-1">
                  <div className="font-medium group-hover:text-white group-hover:[text-shadow:0_1px_2px_rgba(0,0,0,0.45)]">{item.name}</div>
                  <div className="text-xs text-gray-500 group-hover:text-white group-hover:[text-shadow:0_1px_2px_rgba(0,0,0,0.45)]">{item.baseline}</div>
                </div>
                <ExternalLink size={16} className="text-gray-400 group-hover:text-white" />
              </a>
            ) : (
              <Link
                to={item.link}
                className="flex items-center gap-3 bg-white hover:bg-[var(--hover-bg)] p-3 rounded-lg shadow-lg border border-gray-200 transition-colors group min-w-48"
                style={{ ...( { ['--hover-bg']: withAlpha(item.color || '#22c55e', 0.2) } as React.CSSProperties & Record<string, string | number>) }}
              >
                <div 
                  className="p-4 rounded-lg group-hover:text-white group-hover:[text-shadow:0_1px_2px_rgba(0,0,0,0.45)] transition-opacity"
                  style={{ backgroundColor: item.color || '#22c55e', color: item.icon_fg || '#ffffff' }}
                >
                  <IconOrDynamic icon={item.icon} size={30} />
                </div>
                <div className="flex-1">
                  <div className="font-medium group-hover:text-white group-hover:[text-shadow:0_1px_2px_rgba(0,0,0,0.45)]">{item.name}</div>
                  <div className="text-xs text-gray-500 group-hover:text-white group-hover:[text-shadow:0_1px_2px_rgba(0,0,0,0.45)]">{item.baseline}</div>
                </div>
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* Bouton principal */}
      <div 
        className={`
          w-14 h-14 bg-primary hover:bg-primary/90
          rounded-full flex items-center justify-center shadow-lg cursor-pointer
          transition-all duration-300 ease-out
          ${isExpanded ? 'scale-110 shadow-xl' : 'scale-100'}
        `}
      >
        <Star 
          size={24} 
          className={`
            text-white transition-transform duration-300
            ${isExpanded ? 'rotate-12' : 'rotate-0'}
          `}
          fill="currentColor"
        />
      </div>
    </div>
  );
};

export default FloatingMenu;
