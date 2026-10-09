import { useEffect, useState, type ButtonHTMLAttributes, type ChangeEvent, type FormEvent, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Switch, useLocation, useParams } from 'wouter';
import {
  ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Check, ChevronDown,
  CircleHelp, Download, ExternalLink, Eye, EyeOff, Feather, Instagram, Layers3, Library,
  LockKeyhole, LogOut, Mail, Menu, Package, Pencil, Plus, Save, Settings, ShieldCheck,
  Plug, Send, Sparkles, Trash2, Truck, Users, X,
} from 'lucide-react';
import {
  getGetAdminBooksQueryKey, getGetAdminSessionQueryKey,
  getGetAdminSettingsQueryKey, getGetStoreBooksQueryKey,
  getGetStoreSettingsQueryKey, getGetAdminOrdersQueryKey, getGetPrintProvidersQueryKey,
  useGetPrintProviders, useSubmitOrderToPrinter, useTestPrintProvider, useUpdatePrintProvider,
  type PrintProvider, type StoreBook, useAdminLogin, useAdminLogout, useCreateBook,
  useCreateCheckoutOrder, useDeleteBook, useGetAdminBooks, useGetAdminOrders,
  useGetAdminSession, useGetAdminSummary, useGetAdminSettings, useGetStoreBooks,
  useGetStoreSettings, useInitializeAdmin, useUpdateBook, useUpdateStoreSettings,
  type Book, type BookInput, type Order, type StoreSettings,
  type StoreSettingsInput,
} from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Router as WouterRouter } from 'wouter';
import bookCover from './assets/el-mercado-cover.png';
import './index.css';

const queryClient = new QueryClient();
const brandDefaults: StoreSettings = {
  storeName: 'Cuentos de Educación Financiera Infantil',
  logoUrl: '',
  heroBadge: 'EDUCACIÓN FINANCIERA INFANTIL INTERACTIVA',
  heroTitle: 'Aprender a elegir hoy para construir los sueños del mañana.',
  heroSubtitle: 'Cuentos ilustrados para niños (de 6 a 10 años) y sus familias. Descubre historias interactivas donde los niños aprenden a ahorrar, diferenciar necesidades de deseos y tomar decisiones financieras conscientes junto a sus padres.',
  heroQuote: 'Cuentos ilustrados + Actividades en familia + Guía para padres.',
  contactEmail: '',
  instagramUrl: '',
  facebookUrl: '',
};

function errorText(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Ha ocurrido un error. Inténtalo de nuevo.';
}

function currency(amount: number, code: 'EUR' | 'USD') {
  return new Intl.NumberFormat('es', { style: 'currency', currency: code }).format(amount);
}

function Button({
  children, kind = 'primary', className = '', ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { kind?: 'primary' | 'quiet' | 'danger' }) {
  return <button className={`button button-${kind} ${className}`} {...props}>{children}</button>;
}

function Field({
  label, hint, ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input className="control" {...props} />
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

function TextField({
  label, ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return <label className="field"><span className="field-label">{label}</span><textarea className="control textarea" {...props} /></label>;
}

function Notice({ children, tone = 'error' }: { children: ReactNode; tone?: 'error' | 'success' | 'info' }) {
  return <div role="status" className={`notice notice-${tone}`}>{children}</div>;
}

function LoadingRows({ count = 3 }: { count?: number }) {
  return <div className="skeleton-stack" aria-label="Cargando contenido">{Array.from({ length: count }, (_, i) => <div className="skeleton-row" key={i} />)}</div>;
}

function TopBar({ settings }: { settings: StoreSettings }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="brand-lockup" data-testid="link-home">
          {settings.logoUrl ? <img className="brand-image" src={settings.logoUrl} alt="" /> : <span className="brand-mark"><Feather size={19} strokeWidth={1.7} /></span>}
          <span className="brand-copy"><strong>{settings.storeName}</strong><small>Historias para crecer</small></span>
        </Link>
        <button className="mobile-menu" type="button" aria-label="Abrir menú" onClick={() => setMenuOpen(!menuOpen)} data-testid="button-menu"><Menu size={21} /></button>
        <nav className={`site-nav ${menuOpen ? 'nav-open' : ''}`}>
          <a href="/#libros" onClick={() => setMenuOpen(false)}>Los cuentos</a>
          <a href="/#como-aprendemos" onClick={() => setMenuOpen(false)}>Cómo aprendemos</a>
          <a href="/#familias" onClick={() => setMenuOpen(false)}>Para familias</a>
          <Link href="/#libros" className="nav-cta" onClick={() => setMenuOpen(false)}>Explorar cuentos <ArrowRight size={15} /></Link>
        </nav>
      </div>
    </header>
  );
}

function Storefront() {
  const booksQuery = useGetStoreBooks();
  const settingsQuery = useGetStoreSettings();
  const settings = settingsQuery.data ?? brandDefaults;
  const books = booksQuery.data ?? [];
  return (
    <div className="paper-grain store-page">
      <TopBar settings={settings} />
      <main>
        <section className="hero-section">
          {settingsQuery.isError && <div className="public-settings-warning" role="status">No pudimos cargar algunos ajustes de la tienda. Mostramos la información predeterminada.</div>}
          <div className="hero-inner">
            <div className="hero-copy">
              <div className="eyebrow animate-rise"><span className="eyebrow-dot" />{settings.heroBadge}</div>
              <h1 className="animate-rise delay-1">{settings.heroTitle}</h1>
              <p className="hero-description animate-rise delay-2">{settings.heroSubtitle}</p>
              <div className="hero-actions animate-rise delay-3">
                <a className="button button-primary" href="#libros">Descubre los cuentos <ArrowRight size={17} /></a>
                <span className="hero-age"><span className="age-icon"><BookOpen size={16} /></span> Pensados para 6 a 10 años</span>
              </div>
              <div className="hero-quote"><span className="quote-mark">“</span><span>{settings.heroQuote}</span></div>
            </div>
            <div className="hero-art animate-drift">
              <div className="sun-disc" />
              <span className="art-spark spark-a"><Sparkles size={21} /></span>
              <span className="art-spark spark-b"><Sparkles size={16} /></span>
              <div className="art-caption"><span>Una historia,</span><em>muchas decisiones.</em></div>
              <div className="book-mock">
                <img src={bookCover} alt="Portada de El Mercado de los Deseos" />
              </div>
              <span className="art-stamp">30<br /><small>PÁGINAS</small></span>
              <span className="art-note">lee · conversa · decide</span>
            </div>
          </div>
          <div className="hero-bottom-rule"><span>CRECER TAMBIÉN ES APRENDER A ELEGIR</span><div className="storybook-rule" /><span>01 — UN CUENTO A LA VEZ</span></div>
        </section>

        <section className="intro-strip" id="como-aprendemos">
          <div className="intro-number">01<span>/03</span></div>
          <p>El dinero no tiene por qué ser un tema difícil.<br /><strong>Puede empezar con una buena historia.</strong></p>
          <div className="intro-doodle"><span className="doodle-circle">€</span><ArrowDownRight size={24} /></div>
        </section>

        <section className="books-section" id="libros">
          <div className="section-heading">
            <div><span className="section-kicker">LA BIBLIOTECA DE LA FAMILIA</span><h2>Historias que abren<br /><em>nuevos caminos.</em></h2></div>
            <p>Cada cuento invita a detenerse, conversar y tomar pequeñas decisiones que acompañan toda una vida.</p>
          </div>
          {booksQuery.isLoading ? <LoadingRows count={2} /> : booksQuery.isError ? (
            <div className="empty-state"><CircleHelp size={28} /><h3>No pudimos abrir la biblioteca</h3><p>{errorText(booksQuery.error)}</p><Button kind="quiet" onClick={() => booksQuery.refetch()}>Intentar de nuevo</Button></div>
          ) : books.length === 0 ? (
            <div className="empty-state"><Library size={28} /><h3>La próxima historia está en camino</h3><p>Estamos preparando nuevos cuentos para compartir en familia.</p></div>
          ) : (
            <div className="book-list">
              {books.map((book, index) => <BookCard key={book.id} book={book} index={index} />)}
            </div>
          )}
        </section>

        <section className="family-section" id="familias">
          <div className="family-illustration">
            <div className="family-paper"><span className="family-sticker">JUNTOS<br />APRENDEMOS</span><div className="family-sun" /><div className="family-hill hill-one" /><div className="family-hill hill-two" /><div className="family-lines"><span /><span /><span /></div></div>
          </div>
          <div className="family-copy"><span className="section-kicker">UNA HISTORIA TAMBIÉN ES UNA CONVERSACIÓN</span><h2>Para leer con ellos.<br /><em>Y aprender junto a ellos.</em></h2><p>Los niños no necesitan respuestas perfectas. Necesitan espacio para preguntar, imaginar y ensayar sus propias decisiones, con una persona adulta cerca.</p><ul><li><span><Check size={14} /></span>Actividades sencillas para hacer en familia</li><li><span><Check size={14} /></span>Situaciones cercanas a su día a día</li><li><span><Check size={14} /></span>Una guía pensada también para madres y padres</li></ul><a href="#libros" className="text-link">Elige una historia <ArrowRight size={16} /></a></div>
        </section>

        <section className="closing-note">
          <span className="closing-ornament"><Feather size={27} /></span>
          <p>“El mejor momento para hablar de decisiones es <em>cuando todavía parecen pequeñas.</em>”</p>
          <span className="closing-byline">UN CUENTO PUEDE SER EL COMIENZO</span>
        </section>
      </main>
      <StoreFooter settings={settings} />
    </div>
  );
}

function BookCard({ book, index }: { book: StoreBook; index: number }) {
  const cover = book.coverImageUrl || bookCover;
  return (
    <article className={`book-card card-offset-${index % 2}`} data-testid={`card-book-${book.id}`}>
      <div className="book-card-image"><img src={cover} alt={`Portada de ${book.title}`} /></div>
      <div className="book-card-copy"><span className="section-kicker">UN CUENTO ILUSTRADO</span><span className="book-age-pill">{book.recommendedAge}</span><h3>{book.title}</h3><p className="book-subtitle">{book.subtitle}</p><p className="book-description">{book.shortDescription || book.description}</p><div className="book-card-meta"><span><BookOpen size={15} /> {book.pages} páginas</span><span className="meta-author">por {book.author}</span></div><div className="book-card-bottom"><span className="book-price">{currency(book.priceEur, 'EUR')}<small> / {currency(book.priceUsd, 'USD')}</small></span><Link href={`/checkout/${book.id}`} className="button button-primary" data-testid={`link-buy-${book.id}`}>Quiero leerlo <ArrowRight size={16} /></Link></div></div>
    </article>
  );
}

function StoreFooter({ settings }: { settings: StoreSettings }) {
  return (
    <footer className="store-footer"><div className="footer-main"><div><Link href="/" className="brand-lockup footer-brand"><span className="brand-mark"><Feather size={18} /></span><span className="brand-copy"><strong>{settings.storeName}</strong><small>Pequeñas decisiones, grandes sueños</small></span></Link></div><p>Historias para conversar<br />y crecer en familia.</p><div className="footer-links">{settings.contactEmail && <a href={`mailto:${settings.contactEmail}`}><Mail size={15} /> Escríbenos</a>}{settings.instagramUrl && <a href={settings.instagramUrl} target="_blank" rel="noreferrer"><Instagram size={15} /> Instagram <ExternalLink size={12} /></a>}{settings.facebookUrl && <a href={settings.facebookUrl} target="_blank" rel="noreferrer">Facebook <ExternalLink size={12} /></a>}<Link href="/admin">Administración</Link></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} {settings.storeName}</span><span>Un espacio para aprender, preguntar y soñar.</span></div></footer>
  );
}

const blankShipping = { fullName: '', email: '', phone: '', address: '', city: '', state: '', postalCode: '', country: '' };
function CheckoutPage() {
  const { id = '' } = useParams<{ id: string }>();
  const booksQuery = useGetStoreBooks();
  const settingsQuery = useGetStoreSettings();
  const settings = settingsQuery.data ?? brandDefaults;
  const book = booksQuery.data?.find((item) => item.id === id);
  const checkout = useCreateCheckoutOrder();
  const [currencyChoice, setCurrencyChoice] = useState<'EUR' | 'USD'>('EUR');
  const [shipping, setShipping] = useState(blankShipping);
  const [notice, setNotice] = useState('');
  const [redirecting, setRedirecting] = useState(false);
  const update = (key: keyof typeof blankShipping) => (event: ChangeEvent<HTMLInputElement>) => setShipping((old) => ({ ...old, [key]: event.target.value }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!book) return;
    setNotice('');
    checkout.mutate({ data: { bookId: book.id, currency: currencyChoice, shipping } }, {
      onSuccess: (result) => {
        if (result.redirectUrl) {
          setRedirecting(true);
          setNotice('Tus datos están guardados. Te llevamos a la página segura de pago.');
          window.location.assign(result.redirectUrl);
        } else {
          setNotice('El pedido se registró, pero no hay una página de pago configurada para esta moneda.');
        }
      },
      onError: (error) => setNotice(errorText(error)),
    });
  };
  return (
    <div className="paper-grain checkout-page"><TopBar settings={settings} /><main className="checkout-main">
      <Link href="/" className="back-link"><ArrowLeft size={16} /> Volver a la biblioteca</Link>
      {booksQuery.isLoading ? <div className="checkout-loading"><LoadingRows count={4} /></div> : booksQuery.isError ? <div className="empty-state"><h2>No pudimos cargar este cuento</h2><p>{errorText(booksQuery.error)}</p><Button kind="quiet" onClick={() => booksQuery.refetch()}>Intentar de nuevo</Button></div> : !book ? <div className="empty-state"><Package size={30} /><h2>No encontramos ese cuento</h2><p>Puede que el enlace haya cambiado. Vuelve a la biblioteca para elegir otra historia.</p><Link className="button button-primary" href="/">Ir a los cuentos <ArrowRight size={16} /></Link></div> : (
        <div className="checkout-layout">
          <section className="checkout-form-wrap"><div className="checkout-title"><span className="section-kicker">UN NUEVO CUENTO TE ESPERA</span><h1>Completemos<br /><em>la aventura.</em></h1><p>Déjanos tus datos de envío y elige la moneda para continuar.</p></div>
            <form onSubmit={submit} className="shipping-form">
              <div className="form-section-heading"><span>01</span><div><strong>Datos de envío</strong><small>Todos los campos son obligatorios</small></div></div>
              <div className="field-grid"><Field label="Nombre completo" name="fullName" autoComplete="name" required minLength={2} value={shipping.fullName} onChange={update('fullName')} data-testid="input-full-name" /><Field label="Correo electrónico" name="email" type="email" autoComplete="email" required value={shipping.email} onChange={update('email')} data-testid="input-email" /><Field label="Teléfono" name="phone" type="tel" autoComplete="tel" required minLength={6} value={shipping.phone} onChange={update('phone')} data-testid="input-phone" /><Field label="Dirección" name="address" autoComplete="street-address" required minLength={4} value={shipping.address} onChange={update('address')} data-testid="input-address" /><Field label="Ciudad" name="city" autoComplete="address-level2" required value={shipping.city} onChange={update('city')} data-testid="input-city" /><Field label="Estado / Provincia" name="state" autoComplete="address-level1" required value={shipping.state} onChange={update('state')} data-testid="input-state" /><Field label="Código postal" name="postalCode" autoComplete="postal-code" required value={shipping.postalCode} onChange={update('postalCode')} data-testid="input-postal-code" /><Field label="País" name="country" autoComplete="country-name" required value={shipping.country} onChange={update('country')} data-testid="input-country" /></div>
              <div className="form-section-heading currency-heading"><span>02</span><div><strong>Elige tu moneda</strong><small>El pago se completará en una página externa segura</small></div></div>
              <div className="currency-options"><button type="button" className={`currency-choice ${currencyChoice === 'EUR' ? 'selected' : ''}`} onClick={() => setCurrencyChoice('EUR')} data-testid="button-currency-eur"><span className="currency-circle">€</span><span><strong>Euros</strong><small>EUR</small></span><b>{currency(book.priceEur, 'EUR')}</b></button><button type="button" className={`currency-choice ${currencyChoice === 'USD' ? 'selected' : ''}`} onClick={() => setCurrencyChoice('USD')} data-testid="button-currency-usd"><span className="currency-circle">$</span><span><strong>Dólares</strong><small>USD</small></span><b>{currency(book.priceUsd, 'USD')}</b></button></div>
              <p className="redirect-explainer"><ShieldCheck size={17} /> Al continuar, guardaremos tus datos y te redirigiremos a la página de pago configurada para esta moneda.</p>
              {notice && <Notice tone={redirecting ? 'success' : 'error'}>{notice}</Notice>}
              <Button type="submit" disabled={checkout.isPending || redirecting} className="checkout-submit" data-testid="button-submit-checkout">{checkout.isPending ? 'Preparando tu pago…' : redirecting ? 'Redirigiendo…' : <>Continuar al pago seguro <ArrowUpRight size={17} /></>}</Button>
            </form>
          </section>
          <aside className="order-summary"><span className="section-kicker">TU ELECCIÓN</span><div className="summary-cover"><img src={book.coverImageUrl || bookCover} alt={`Portada de ${book.title}`} /></div><span className="summary-label">CUENTO ILUSTRADO</span><h2>{book.title}</h2><p>{book.subtitle}</p><div className="summary-detail"><span><BookOpen size={15} />{book.pages} páginas</span><span><Users size={15} />{book.recommendedAge}</span></div><div className="summary-total"><span>Total</span><strong>{currency(currencyChoice === 'EUR' ? book.priceEur : book.priceUsd, currencyChoice)}</strong></div><p className="summary-note"><LockKeyhole size={14} /> Tus datos solo se utilizan para gestionar este pedido.</p></aside>
        </div>
      )}
    </main><StoreFooter settings={settings} /></div>
  );
}

function AdminGate({ children }: { children: ReactNode }) {
  const sessionQuery = useGetAdminSession();
  const queryClient = useQueryClient();
  const setup = useInitializeAdmin();
  const login = useAdminLogin();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const session = sessionQuery.data;
  const mutateAuth = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const mutation = session?.configured ? login : setup;
    mutation.mutate({ data: { password } }, {
      onSuccess: () => {
        setPassword('');
        queryClient.invalidateQueries({ queryKey: getGetAdminSessionQueryKey() });
      },
      onError: (err) => setError(errorText(err)),
    });
  };
  if (sessionQuery.isLoading) return <div className="admin-auth-shell"><div className="auth-card"><div className="auth-seal"><Feather /></div><p className="section-kicker">ESPACIO PRIVADO</p><h1>Abriendo el escritorio…</h1><LoadingRows count={2} /></div></div>;
  if (sessionQuery.isError) return <div className="admin-auth-shell"><div className="auth-card"><div className="auth-seal"><CircleHelp /></div><p className="section-kicker">NO DISPONIBLE</p><h1>No pudimos comprobar el acceso.</h1><p>{errorText(sessionQuery.error)}</p><Button kind="quiet" onClick={() => sessionQuery.refetch()}>Volver a intentar</Button><Link href="/" className="text-link">Volver a la tienda <ArrowRight size={15} /></Link></div></div>;
  if (!session?.authenticated) return (
    <div className="admin-auth-shell paper-grain"><div className="auth-illustration"><div className="auth-sun" /><div className="auth-book"><BookOpen size={54} strokeWidth={1.2} /><span>CUENTOS<br />QUE ENSEÑAN</span></div><span className="auth-handnote">El taller de las historias</span></div><section className="auth-card"><Link href="/" className="back-link"><ArrowLeft size={15} /> Volver a la tienda</Link><div className="auth-seal"><LockKeyhole size={22} /></div><p className="section-kicker">{session?.configured ? 'ACCESO PARA LA FAMILIA EDITORA' : 'PRIMER PASO · CONFIGURACIÓN'}</p><h1>{session?.configured ? 'Qué bueno tenerte de vuelta.' : 'Prepara tu espacio de trabajo.'}</h1><p className="auth-desc">{session?.configured ? 'Ingresa tu contraseña para administrar los cuentos y pedidos.' : 'Crea una contraseña segura para proteger la administración de tu tienda.'}</p>
      {!session?.configured && <Notice tone="info">Aún no hay una contraseña de administración. Configúrala aquí; debe tener al menos 12 caracteres.</Notice>}
      <form onSubmit={mutateAuth}><label className="field"><span className="field-label">{session?.configured ? 'Contraseña' : 'Nueva contraseña'}</span><span className="password-wrap"><input className="control" type={showPassword ? 'text' : 'password'} required minLength={12} maxLength={200} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={session?.configured ? 'current-password' : 'new-password'} data-testid="input-admin-password" /><button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} data-testid="button-toggle-password">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>{error && <Notice>{error}</Notice>}<Button className="auth-submit" type="submit" disabled={setup.isPending || login.isPending} data-testid="button-admin-auth">{setup.isPending || login.isPending ? 'Un momento…' : session?.configured ? <>Entrar al escritorio <ArrowRight size={16} /></> : <>Crear contraseña segura <ShieldCheck size={16} /></>}</Button></form><div className="auth-footnote"><ShieldCheck size={15} /> Tu acceso está protegido y solo es para administración.</div>
    </section></div>
  );
  return <>{children}</>;
}

function AdminShell({ children, current }: { children: ReactNode; current: 'summary' | 'books' | 'orders' | 'integrations' | 'settings' }) {
  const [, setLocation] = useLocation();
  const logout = useAdminLogout();
  const queryClient = useQueryClient();
  const navItems = [
    { href: '/admin', label: 'Resumen', icon: Layers3, key: 'summary' },
    { href: '/admin/books', label: 'Cuentos', icon: BookOpen, key: 'books' },
    { href: '/admin/orders', label: 'Pedidos', icon: Package, key: 'orders' },
    { href: '/admin/integrations', label: 'Integraciones', icon: Plug, key: 'integrations' },
    { href: '/admin/settings', label: 'Tienda', icon: Settings, key: 'settings' },
  ];
  return <div className="admin-layout"><aside className="admin-sidebar"><Link href="/" className="admin-brand"><span className="brand-mark"><Feather size={18} /></span><span><strong>El pequeño<br />escritorio</strong><small>CUENTOS · ADMIN</small></span></Link><div className="sidebar-label">GESTIONAR</div><nav className="admin-nav">{navItems.map((item) => { const Icon = item.icon; return <Link href={item.href} key={item.key} className={`admin-nav-link ${current === item.key ? 'active' : ''}`} data-testid={`link-admin-${item.key}`}><Icon size={17} />{item.label}{current === item.key && <span className="nav-current" />}</Link>; })}</nav><div className="sidebar-bottom"><div className="sidebar-status"><span className="status-indicator" />Tienda conectada</div><Link href="/" className="store-link"><ExternalLink size={15} /> Ver tienda</Link><button type="button" className="logout-button" disabled={logout.isPending} onClick={() => logout.mutate(undefined, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetAdminSessionQueryKey() }); setLocation('/admin'); } })} data-testid="button-logout"><LogOut size={15} />{logout.isPending ? 'Saliendo…' : 'Cerrar sesión'}</button></div></aside><div className="admin-main"><header className="admin-topbar"><div className="topbar-breadcrumb"><span>CUENTOS DE EDUCACIÓN FINANCIERA</span><ChevronDown size={14} /><strong>{navItems.find((item) => item.key === current)?.label}</strong></div><div className="admin-user"><span className="admin-avatar">CR</span><span>Administración</span></div></header><main className="admin-content">{children}</main><footer className="admin-footer">Un buen cuento siempre empieza con una pregunta.</footer></div></div>;
}

function AdminOverview() {
  const query = useGetAdminSummary();
  const summary = query.data;
  return <AdminShell current="summary"><div className="admin-page-heading"><div><span className="section-kicker">TU ESPACIO DE TRABAJO</span><h1>Buenos días,<br /><em>familia cuentista.</em></h1><p>Una mirada sencilla a lo que está ocurriendo en tu tienda.</p></div><Link href="/admin/books" className="button button-primary"><Plus size={16} /> Gestionar cuentos</Link></div>
    {query.isLoading ? <LoadingRows count={3} /> : query.isError ? <div className="admin-panel"><Notice>{errorText(query.error)}</Notice><Button kind="quiet" onClick={() => query.refetch()}>Volver a cargar</Button></div> : <><div className="stat-row"><div className="stat-card"><span className="stat-label"><BookOpen size={16} />CUENTOS EN LA TIENDA</span><strong>{summary?.bookCount ?? 0}</strong><span className="stat-caption">historias disponibles</span><span className="stat-icon tint-coral"><Library size={19} /></span></div><div className="stat-card"><span className="stat-label"><Package size={16} />PEDIDOS RECIBIDOS</span><strong>{summary?.orderCount ?? 0}</strong><span className="stat-caption">en total</span><span className="stat-icon tint-sage"><Truck size={19} /></span></div><div className="stat-card"><span className="stat-label"><Sparkles size={16} />PEDIDOS RECIENTES</span><strong>{summary?.recentOrderCount ?? 0}</strong><span className="stat-caption">en los últimos 30 días</span><span className="stat-icon tint-gold"><ArrowUpRight size={19} /></span></div></div><div className="overview-lower"><section className="admin-panel quick-panel"><div className="panel-heading"><div><span className="section-kicker">ACCIONES RÁPIDAS</span><h2>¿Qué hacemos hoy?</h2></div><span className="panel-flower"><Sparkles size={18} /></span></div><div className="quick-links"><Link href="/admin/books" className="quick-link"><span className="quick-icon"><BookOpen size={18} /></span><span><strong>Añadir o editar un cuento</strong><small>Prepara la próxima historia para publicar</small></span><ArrowRight size={16} /></Link><Link href="/admin/orders" className="quick-link"><span className="quick-icon"><Package size={18} /></span><span><strong>Revisar los pedidos</strong><small>Consulta y exporta la lista de pedidos</small></span><ArrowRight size={16} /></Link><Link href="/admin/settings" className="quick-link"><span className="quick-icon"><Settings size={18} /></span><span><strong>Actualizar la tienda</strong><small>Cuida cómo se presenta tu proyecto</small></span><ArrowRight size={16} /></Link></div></section><aside className="admin-note"><span className="note-overline">NOTA DEL DÍA</span><span className="note-star">✳</span><p>Las mejores conversaciones empiezan con <em>una pregunta pequeña.</em></p><span className="note-dash" /><span className="note-signoff">— PARA LEER JUNTOS</span></aside></div></>}
  </AdminShell>;
}

const emptyBookForm: BookInput = { title: '', subtitle: '', author: '', shortDescription: '', description: '', recommendedAge: '6 a 10 años (Para leer en familia o en el aula)', pages: 30, priceEur: 0, priceUsd: 0, checkoutUrlEur: '', checkoutUrlUsd: '', coverImageUrl: '', printProductUids: {}, printFileUrl: '', printPageCount: 0 };
function BookEditor({ book, onClose }: { book: Book | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const createBook = useCreateBook();
  const updateBook = useUpdateBook();
  const [form, setForm] = useState<BookInput>(book ? {
    title: book.title, subtitle: book.subtitle, author: book.author, shortDescription: book.shortDescription,
    description: book.description, recommendedAge: book.recommendedAge, pages: book.pages,
    priceEur: book.priceEur, priceUsd: book.priceUsd, checkoutUrlEur: book.checkoutUrlEur,
    checkoutUrlUsd: book.checkoutUrlUsd, coverImageUrl: book.coverImageUrl,
    printProductUids: book.printProductUids, printFileUrl: book.printFileUrl, printPageCount: book.printPageCount,
  } : emptyBookForm);
  const providersQuery = useGetPrintProviders();
  const [error, setError] = useState('');
  const set = (key: keyof BookInput) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((current) => ({ ...current, [key]: key === 'pages' || key === 'priceEur' || key === 'priceUsd' || key === 'printPageCount' ? Number(event.target.value) : event.target.value } as BookInput));
  const submit = (event: FormEvent) => {
    event.preventDefault(); setError('');
    const onSuccess = () => {
      queryClient.invalidateQueries({ queryKey: getGetAdminBooksQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetStoreBooksQueryKey() });
      onClose();
    };
    const onError = (err: unknown) => setError(errorText(err));
    if (book) updateBook.mutate({ id: book.id, data: form }, { onSuccess, onError });
    else createBook.mutate({ data: form }, { onSuccess, onError });
  };
  const pending = createBook.isPending || updateBook.isPending;
  return <div className="modal-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="editor-modal" role="dialog" aria-modal="true" aria-labelledby="editor-title"><header className="modal-header"><div><span className="section-kicker">{book ? 'EDICIÓN DE CUENTO' : 'NUEVA HISTORIA'}</span><h2 id="editor-title">{book ? 'Editar cuento' : 'Añadir un cuento'}</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar editor" data-testid="button-close-editor"><X size={19} /></button></header><form className="editor-form" onSubmit={submit}><div className="field-grid"><Field label="Título" value={form.title} onChange={set('title')} required maxLength={200} data-testid="input-book-title" /><Field label="Autoría" value={form.author} onChange={set('author')} maxLength={160} data-testid="input-book-author" /><Field label="Subtítulo" value={form.subtitle} onChange={set('subtitle')} maxLength={300} data-testid="input-book-subtitle" /><Field label="Edad recomendada" value={form.recommendedAge} onChange={set('recommendedAge')} maxLength={100} data-testid="input-book-age" /><Field label="Páginas" type="number" min="1" max="5000" value={form.pages} onChange={set('pages')} required data-testid="input-book-pages" /><Field label="Precio en EUR" type="number" min="0" step="0.01" value={form.priceEur} onChange={set('priceEur')} required data-testid="input-book-price-eur" /><Field label="Precio en USD" type="number" min="0" step="0.01" value={form.priceUsd} onChange={set('priceUsd')} required data-testid="input-book-price-usd" /><Field label="URL de portada" value={form.coverImageUrl} onChange={set('coverImageUrl')} maxLength={2000} data-testid="input-book-cover" /></div><TextField label="Descripción breve para la tienda" value={form.shortDescription} onChange={set('shortDescription')} maxLength={500} rows={2} data-testid="input-book-short-description" /><TextField label="Descripción completa" value={form.description} onChange={set('description')} maxLength={10000} rows={4} data-testid="input-book-description" /><div className="field-grid"><Field label="Enlace de pago EUR" value={form.checkoutUrlEur} onChange={set('checkoutUrlEur')} maxLength={2000} data-testid="input-book-checkout-eur" /><Field label="Enlace de pago USD" value={form.checkoutUrlUsd} onChange={set('checkoutUrlUsd')} maxLength={2000} data-testid="input-book-checkout-usd" /></div>
    <div className="settings-section-head settings-copy-head"><span className="settings-number">POD</span><div><h2>Impresión bajo demanda</h2><p>Códigos y archivo que la imprenta usa para fabricar este libro.</p></div></div>
    <div className="field-grid">{(providersQuery.data ?? []).map((provider) => <Field key={provider.id} label={provider.productField.label} hint={provider.productField.help} placeholder={provider.productField.placeholder} value={form.printProductUids?.[provider.id] ?? ''} onChange={(event) => setForm((current) => ({ ...current, printProductUids: { ...(current.printProductUids ?? {}), [provider.id]: event.target.value } }))} maxLength={300} data-testid={`input-book-print-uid-${provider.id}`} />)}<Field label="URL del PDF de impresión" hint="PDF listo para imprimir (portada + interior), accesible por la imprenta. No se muestra en la tienda." value={form.printFileUrl ?? ''} onChange={set('printFileUrl')} maxLength={2000} data-testid="input-book-print-file" /><Field label="Páginas para la imprenta" type="number" min="0" max="5000" hint="Total con portadas. 0 = usar el número de páginas del cuento." value={form.printPageCount ?? 0} onChange={set('printPageCount')} data-testid="input-book-print-pages" /></div>{error && <Notice>{error}</Notice>}<div className="modal-actions"><Button type="button" kind="quiet" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={pending} data-testid="button-save-book">{pending ? 'Guardando…' : <><Save size={16} />{book ? 'Guardar cambios' : 'Añadir cuento'}</>}</Button></div></form></section></div>;
}

function AdminBooks() {
  const query = useGetAdminBooks();
  const deleteBook = useDeleteBook();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Book | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const remove = (book: Book) => {
    if (!window.confirm(`¿Eliminar “${book.title}” de la tienda? Esta acción no se puede deshacer.`)) return;
    setDeleteError('');
    deleteBook.mutate({ id: book.id }, { onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getGetAdminBooksQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetStoreBooksQueryKey() });
    }, onError: (error) => setDeleteError(errorText(error)) });
  };
  return <AdminShell current="books"><div className="admin-page-heading"><div><span className="section-kicker">BIBLIOTECA DE LA TIENDA</span><h1>Historias en<br /><em>construcción.</em></h1><p>Cuida los detalles de cada cuento que llega a una familia.</p></div><Button onClick={() => { setEditing(null); setEditorOpen(true); }} data-testid="button-add-book"><Plus size={17} /> Añadir cuento</Button></div>{deleteError && <Notice>{deleteError}</Notice>}
    {query.isLoading ? <LoadingRows count={4} /> : query.isError ? <div className="admin-panel"><Notice>{errorText(query.error)}</Notice><Button kind="quiet" onClick={() => query.refetch()}>Volver a cargar</Button></div> : query.data?.length ? <div className="admin-book-list">{query.data.map((book) => <article className="admin-book-row" key={book.id} data-testid={`row-book-${book.id}`}><img src={book.coverImageUrl || bookCover} alt="" /><div className="admin-book-info"><span className="book-row-age">{book.recommendedAge}</span><h2>{book.title}</h2><p>{book.subtitle}</p><span className="admin-book-prices">{currency(book.priceEur, 'EUR')} <i>·</i> {currency(book.priceUsd, 'USD')} <i>·</i> {book.pages} págs.</span></div><div className="row-actions"><button className="icon-button" type="button" onClick={() => { setEditing(book); setEditorOpen(true); }} aria-label={`Editar ${book.title}`} data-testid={`button-edit-book-${book.id}`}><Pencil size={17} /></button><button className="icon-button icon-danger" type="button" onClick={() => remove(book)} disabled={deleteBook.isPending} aria-label={`Eliminar ${book.title}`} data-testid={`button-delete-book-${book.id}`}><Trash2 size={17} /></button></div></article>)}</div> : <div className="empty-state admin-empty"><div className="empty-illustration"><BookOpen size={30} /></div><h2>La biblioteca está por estrenar.</h2><p>Añade tu primer cuento para que las familias puedan descubrirlo.</p><Button onClick={() => { setEditing(null); setEditorOpen(true); }}><Plus size={16} /> Crear el primer cuento</Button></div>}{editorOpen && <BookEditor book={editing} onClose={() => setEditorOpen(false)} />}</AdminShell>;
}

function exportErrorMessage(message: string) {
  try { const data = JSON.parse(message) as { message?: string }; return data.message || message; } catch { return message; }
}
function AdminOrders() {
  const query = useGetAdminOrders();
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [exportSuccess, setExportSuccess] = useState('');
  const download = async () => {
    setExporting(true); setError(''); setExportSuccess('');
    try {
      const response = await fetch('/api/admin/orders/export.csv', { method: 'GET', credentials: 'include', headers: { Accept: 'text/csv' } });
      if (!response.ok) throw new Error(exportErrorMessage(await response.text()));
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `pedidos-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click();
      URL.revokeObjectURL(url);
      setExportSuccess('El archivo CSV está listo.');
    } catch (err) { setError(errorText(err)); }
    finally { setExporting(false); }
  };
  return <AdminShell current="orders"><div className="admin-page-heading"><div><span className="section-kicker">CUANDO UNA HISTORIA ENCUENTRA HOGAR</span><h1>Pedidos con<br /><em>destino.</em></h1><p>Consulta los datos compartidos durante el proceso de compra.</p></div><Button kind="quiet" onClick={download} disabled={exporting || !query.data?.length} data-testid="button-export-orders"><Download size={16} />{exporting ? 'Preparando…' : 'Exportar CSV'}</Button></div>{error && <Notice>{error}</Notice>}{exportSuccess && <Notice tone="success">{exportSuccess}</Notice>}{query.isLoading ? <LoadingRows count={5} /> : query.isError ? <div className="admin-panel"><Notice>{errorText(query.error)}</Notice><Button kind="quiet" onClick={() => query.refetch()}>Volver a cargar</Button></div> : query.data?.length ? <OrdersTable orders={query.data} /> : <div className="empty-state admin-empty"><div className="empty-illustration"><Package size={29} /></div><h2>Aún no hay pedidos.</h2><p>Cuando una familia inicie una compra, la información aparecerá aquí.</p><Link href="/" className="text-link">Volver a la tienda <ArrowRight size={15} /></Link></div>}</AdminShell>;
}

function OrdersTable({ orders }: { orders: Order[] }) {
  return <div className="orders-table-wrap"><table className="orders-table"><thead><tr><th>FAMILIA</th><th>CUENTO</th><th>FECHA</th><th>MONEDA</th><th>TOTAL</th><th>ENVÍO</th><th>PAGO</th><th>IMPRENTA</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id} data-testid={`row-order-${order.id}`}><td><strong>{order.fullName}</strong><a href={`mailto:${order.email}`}>{order.email}</a><small>{order.phone}</small></td><td><strong>{order.bookTitle}</strong><small>Pedido {order.id.slice(0, 8)}</small></td><td>{new Date(order.createdAt).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}</td><td><span className="currency-pill">{order.currency}</span></td><td className="order-amount">{currency(order.amount, order.currency)}</td><td>{order.address}<br />{order.city}, {order.state}<br />{order.postalCode} · {order.country}</td><td><span className={`status-pill status-${order.paymentStatus}`}>{order.paymentStatus === 'paid' ? 'Pagado' : 'Pendiente'}</span></td><td><PrintCell order={order} /></td></tr>)}</tbody></table></div>;
}

const printStatusLabel: Record<Order['printStatus'], string> = {
  none: 'Sin enviar', submitting: 'Enviando…', draft: 'Borrador (prueba)', submitted: 'Enviado', failed: 'Con error', skipped: 'Omitido',
};

function PrintCell({ order }: { order: Order }) {
  const queryClient = useQueryClient();
  const submit = useSubmitOrderToPrinter();
  const [message, setMessage] = useState('');
  const paid = order.paymentStatus === 'paid';
  const canSend = order.printStatus !== 'submitting' && order.printStatus !== 'submitted';
  const label = !paid ? 'Marcar pagado y enviar' : order.printStatus === 'failed' ? 'Reintentar envío' : 'Enviar a imprenta';
  const send = () => {
    if (!paid && !window.confirm('¿Confirmas que este pedido ya está pagado? Se enviará a la imprenta.')) return;
    setMessage('');
    submit.mutate({ id: order.id, data: { markPaid: !paid } }, {
      onSuccess: (result) => { setMessage(result.message); queryClient.invalidateQueries({ queryKey: getGetAdminOrdersQueryKey() }); },
      onError: (err) => setMessage(errorText(err)),
    });
  };
  return <div className="print-cell">
    <span className={`status-pill print-${order.printStatus}`}>{printStatusLabel[order.printStatus]}</span>
    {order.printExternalId && <small>Ref. {order.printExternalId.slice(0, 8)}</small>}
    {order.printError && <small className="print-error">{order.printError}</small>}
    {canSend && <button type="button" className="text-link print-send" onClick={send} disabled={submit.isPending} data-testid={`button-print-order-${order.id}`}><Send size={13} /> {submit.isPending ? 'Enviando…' : label}</button>}
    {message && <small>{message}</small>}
  </div>;
}

function ProviderCard({ provider }: { provider: PrintProvider }) {
  const queryClient = useQueryClient();
  const update = useUpdatePrintProvider();
  const test = useTestPrintProvider();
  const [enabled, setEnabled] = useState(provider.enabled);
  const [autoSubmit, setAutoSubmit] = useState(provider.autoSubmit);
  const [orderMode, setOrderMode] = useState(provider.orderMode);
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ tone: 'error' | 'success' | 'info'; text: string } | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: getGetPrintProvidersQueryKey() });
  const save = (event: FormEvent) => {
    event.preventDefault(); setNotice(null);
    const credentials = Object.fromEntries(Object.entries(secrets).filter(([, value]) => value.trim()));
    update.mutate({ provider: provider.id, data: { enabled, autoSubmit, orderMode, credentials } }, {
      onSuccess: () => { setSecrets({}); setNotice({ tone: 'success', text: 'Configuración guardada. La clave se almacena cifrada.' }); refresh(); },
      onError: (err) => setNotice({ tone: 'error', text: errorText(err) }),
    });
  };
  const removeKey = (key: string) => {
    if (!window.confirm('¿Quitar esta clave guardada?')) return;
    update.mutate({ provider: provider.id, data: { credentials: { [key]: '' } } }, { onSuccess: refresh, onError: (err) => setNotice({ tone: 'error', text: errorText(err) }) });
  };
  const runTest = () => {
    setNotice(null);
    test.mutate({ provider: provider.id }, {
      onSuccess: (result) => setNotice({ tone: result.ok ? 'success' : 'error', text: result.message }),
      onError: (err) => setNotice({ tone: 'error', text: errorText(err) }),
    });
  };
  return <form className="settings-form admin-panel" onSubmit={save} data-testid={`card-provider-${provider.id}`}>
    <div className="settings-section-head"><span className="settings-number"><Plug size={16} /></span><div><h2>{provider.label}</h2><p>Impresión bajo demanda. <a className="text-link" href={provider.docsUrl} target="_blank" rel="noreferrer">Documentación <ExternalLink size={12} /></a></p></div></div>
    <label className="check-row"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} data-testid={`check-provider-enabled-${provider.id}`} /><span><strong>Activar {provider.label}</strong><small>Solo las imprentas activas reciben pedidos.</small></span></label>
    <div className="settings-form-grid">{provider.credentials.map((field) => <div key={field.key}>
      <Field label={field.label} type="password" autoComplete="off" spellCheck={false} value={secrets[field.key] ?? ''} onChange={(e) => setSecrets((old) => ({ ...old, [field.key]: e.target.value }))} placeholder={field.configured ? `${field.hint} (guardada) · escribe para reemplazarla` : field.placeholder} hint={field.help} maxLength={500} data-testid={`input-provider-${provider.id}-${field.key}`} />
      {field.configured && <button type="button" className="text-link" onClick={() => removeKey(field.key)}>Quitar clave guardada</button>}
    </div>)}</div>
    <label className="check-row"><input type="checkbox" checked={autoSubmit} onChange={(e) => setAutoSubmit(e.target.checked)} /><span><strong>Enviar pedidos automáticamente</strong><small>Al confirmarse el pago, el servidor crea el pedido en {provider.label} con los datos de envío del cliente.</small></span></label>
    <div className="mode-group" role="radiogroup" aria-label="Modo de envío">
      <label className="check-row"><input type="radio" name={`mode-${provider.id}`} checked={orderMode === 'draft'} onChange={() => setOrderMode('draft')} /><span><strong>Modo prueba (borrador)</strong><small>Crea borradores en {provider.label}: no se imprime ni se cobra. Úsalo hasta comprobar un pedido completo.</small></span></label>
      <label className="check-row"><input type="radio" name={`mode-${provider.id}`} checked={orderMode === 'live'} onChange={() => setOrderMode('live')} /><span><strong>Producción</strong><small>Los pedidos se imprimen y se envían de verdad (se cobran en tu cuenta de {provider.label}).</small></span></label>
    </div>
    {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
    <div className="settings-save-row"><Button type="button" kind="quiet" onClick={runTest} disabled={test.isPending || !provider.credentials.every((f) => f.configured)} data-testid={`button-test-${provider.id}`}>{test.isPending ? 'Probando…' : 'Probar conexión'}</Button><Button type="submit" disabled={update.isPending} data-testid={`button-save-${provider.id}`}>{update.isPending ? 'Guardando…' : <><Save size={16} /> Guardar</>}</Button></div>
  </form>;
}

function AdminIntegrations() {
  const query = useGetPrintProviders();
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  return <AdminShell current="integrations"><div className="admin-page-heading"><div><span className="section-kicker">IMPRESIÓN BAJO DEMANDA</span><h1>Integraciones<br /><em>con imprentas.</em></h1><p>Conecta tu imprenta para que cada pedido pagado se fabrique y envíe solo.</p></div></div>
    {query.isLoading ? <LoadingRows count={4} /> : query.isError ? <div className="admin-panel"><Notice>{errorText(query.error)}</Notice><Button kind="quiet" onClick={() => query.refetch()}>Volver a cargar</Button></div> : <>
      {query.data?.map((provider) => <ProviderCard key={provider.id} provider={provider} />)}
      <section className="admin-panel webhook-help"><div className="settings-section-head"><span className="settings-number"><Truck size={16} /></span><div><h2>Cómo se confirma un pago</h2><p>El envío automático se dispara cuando tu pasarela avisa al servidor.</p></div></div>
        <p><strong>Stripe:</strong> crea un webhook con el evento <code>checkout.session.completed</code> apuntando a <code>{origin}/api/webhooks/stripe</code> y guarda su secreto en la variable <code>STRIPE_WEBHOOK_SECRET</code>.</p>
        <p><strong>Otra pasarela:</strong> haz un POST a <code>{origin}/api/webhooks/payment-confirmed</code> con la cabecera <code>Authorization: Bearer &lt;PAYMENT_WEBHOOK_SECRET&gt;</code> y el cuerpo <code>{'{"orderId":"…"}'}</code>.</p>
        <p>Mientras tanto, en <Link href="/admin/orders" className="text-link">Pedidos</Link> puedes enviar cualquier pedido a mano.</p></section></>}
  </AdminShell>;
}

function AdminSettings() {
  const query = useGetAdminSettings();
  const mutation = useUpdateStoreSettings();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<StoreSettingsInput>(brandDefaults);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (query.data && !initialized) {
      setForm({ ...query.data });
      setInitialized(true);
    }
  }, [query.data, initialized]);
  const set = (key: keyof StoreSettingsInput) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setForm((old) => ({ ...old, [key]: event.target.value })); setSaved(false); };
  const submit = (event: FormEvent) => {
    event.preventDefault(); setError(''); setSaved(false);
    mutation.mutate({ data: form }, { onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getGetAdminSettingsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetStoreSettingsQueryKey() });
      setSaved(true);
    }, onError: (err) => setError(errorText(err)) });
  };
  return <AdminShell current="settings"><div className="admin-page-heading"><div><span className="section-kicker">LA VOZ DE TU PROYECTO</span><h1>Un espacio<br /><em>con identidad.</em></h1><p>Actualiza el nombre y las palabras que reciben a cada familia.</p></div></div>{query.isLoading ? <LoadingRows count={4} /> : query.isError ? <div className="admin-panel"><Notice>{errorText(query.error)}</Notice><Button kind="quiet" onClick={() => query.refetch()}>Volver a cargar</Button></div> : <form className="settings-form admin-panel" onSubmit={submit}><div className="settings-section-head"><span className="settings-number">01</span><div><h2>La tienda</h2><p>Nombre y marca que acompañan cada página.</p></div></div><div className="settings-form-grid"><Field label="Nombre de la tienda" value={form.storeName} onChange={set('storeName')} required maxLength={200} data-testid="input-store-name" /><Field label="URL del logo" value={form.logoUrl} onChange={set('logoUrl')} maxLength={2000} data-testid="input-logo-url" /><Field label="Correo de contacto" type="email" value={form.contactEmail} onChange={set('contactEmail')} maxLength={320} data-testid="input-contact-email" /><Field label="Instagram" type="url" value={form.instagramUrl} onChange={set('instagramUrl')} maxLength={2000} data-testid="input-instagram-url" /><Field label="Facebook" type="url" value={form.facebookUrl} onChange={set('facebookUrl')} maxLength={2000} data-testid="input-facebook-url" /></div><div className="settings-section-head settings-copy-head"><span className="settings-number">02</span><div><h2>La portada de bienvenida</h2><p>Las palabras que aparecen en la página principal.</p></div></div><div className="settings-form-grid"><Field label="Distintivo" value={form.heroBadge} onChange={set('heroBadge')} maxLength={200} data-testid="input-hero-badge" /><Field label="Titular principal" value={form.heroTitle} onChange={set('heroTitle')} maxLength={300} data-testid="input-hero-title" /><TextField label="Descripción" value={form.heroSubtitle} onChange={set('heroSubtitle')} maxLength={1200} rows={4} data-testid="input-hero-subtitle" /><TextField label="Frase destacada" value={form.heroQuote} onChange={set('heroQuote')} maxLength={500} rows={2} data-testid="input-hero-quote" /></div>{error && <Notice>{error}</Notice>}{saved && <Notice tone="success">Los cambios se guardaron y ya están disponibles en la tienda.</Notice>}<div className="settings-save-row"><span>Los cambios se publican al guardar.</span><Button type="submit" disabled={mutation.isPending} data-testid="button-save-settings">{mutation.isPending ? 'Guardando…' : <><Save size={16} /> Guardar cambios</>}</Button></div></form>}</AdminShell>;
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Switch>
    <Route path="/" component={Storefront} />
    <Route path="/checkout/:id" component={CheckoutPage} />
    <Route path="/admin"><AdminGate><AdminOverview /></AdminGate></Route>
    <Route path="/admin/books"><AdminGate><AdminBooks /></AdminGate></Route>
    <Route path="/admin/orders"><AdminGate><AdminOrders /></AdminGate></Route>
    <Route path="/admin/integrations"><AdminGate><AdminIntegrations /></AdminGate></Route>
    <Route path="/admin/settings"><AdminGate><AdminSettings /></AdminGate></Route>
    <Route component={NotFound} />
  </Switch></ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;