import {
  BarChart3,
  CalendarDays,
  CheckSquare,
  Clock,
  FlaskConical,
  LayoutDashboard,
  Settings,
  Users,
} from 'lucide-react';
import type { NavRouteId } from '../../types/domain';

export function NavRouteIcon({
  route,
  className = 'h-4 w-4',
}: {
  route: NavRouteId;
  className?: string;
}) {
  switch (route) {
    case 'overview':
      return <LayoutDashboard className={className} />;
    case 'my-attendance':
      return <CheckSquare className={className} />;
    case 'bunk-simulator':
      return <FlaskConical className={className} />;
    case 'mass-bunk-planner':
      return <Users className={className} />;
    case 'academic-calendar':
      return <CalendarDays className={className} />;
    case 'timetable':
      return <Clock className={className} />;
    case 'analytics':
      return <BarChart3 className={className} />;
    case 'settings':
      return <Settings className={className} />;
  }
}
