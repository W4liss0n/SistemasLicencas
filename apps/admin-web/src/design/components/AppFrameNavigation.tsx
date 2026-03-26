import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import KeyOutlinedIcon from '@mui/icons-material/KeyOutlined';
import PeopleOutlineOutlinedIcon from '@mui/icons-material/PeopleOutlineOutlined';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import ViewListOutlinedIcon from '@mui/icons-material/ViewListOutlined';

export const appFrameNavItems = [
  { serial: '01', labelKey: 'nav.dashboard', path: '/dashboard', icon: <DashboardOutlinedIcon fontSize="small" /> },
  { serial: '02', labelKey: 'nav.programs', path: '/programs', icon: <Inventory2OutlinedIcon fontSize="small" /> },
  { serial: '03', labelKey: 'nav.plans', path: '/plans', icon: <ViewListOutlinedIcon fontSize="small" /> },
  { serial: '04', labelKey: 'nav.customers', path: '/customers', icon: <PeopleOutlineOutlinedIcon fontSize="small" /> },
  { serial: '05', labelKey: 'nav.licenseSearch', path: '/licenses/search', icon: <KeyOutlinedIcon fontSize="small" /> },
  { serial: '06', labelKey: 'nav.licenseProvision', path: '/licenses/provision', icon: <PlaylistAddCheckIcon fontSize="small" /> }
] as const;

export function isAppFrameNavItemActive(currentPath: string, itemPath: string): boolean {
  if (itemPath === '/licenses/search') {
    return currentPath.startsWith('/licenses/') && currentPath !== '/licenses/provision';
  }

  return currentPath === itemPath;
}
