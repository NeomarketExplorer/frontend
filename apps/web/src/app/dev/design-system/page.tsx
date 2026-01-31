'use client';

import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Badge,
  Input,
  Label,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@app/ui';

// Color token data
const colorTokens = {
  core: [
    { name: 'background', value: '#0d0f12', var: '--background' },
    { name: 'background-secondary', value: '#16181d', var: '--background-secondary' },
    { name: 'foreground', value: '#e4e4e7', var: '--foreground' },
    { name: 'foreground-muted', value: '#9ca3af', var: '--foreground-muted' },
  ],
  card: [
    { name: 'card', value: 'rgba(22, 24, 29, 0.8)', var: '--card' },
    { name: 'card-solid', value: '#16181d', var: '--card-solid' },
    { name: 'card-hover', value: 'rgba(32, 35, 42, 0.95)', var: '--card-hover' },
    { name: 'card-border', value: 'rgba(45, 50, 60, 0.5)', var: '--card-border' },
  ],
  accent: [
    { name: 'accent', value: '#00ff94', var: '--accent' },
    { name: 'accent-glow', value: 'rgba(0, 255, 148, 0.5)', var: '--accent-glow' },
    { name: 'accent-soft', value: 'rgba(0, 255, 148, 0.1)', var: '--accent-soft' },
  ],
  semantic: [
    { name: 'success', value: '#22c55e', var: '--success' },
    { name: 'danger', value: '#ef4444', var: '--danger' },
    { name: 'secondary', value: '#00e5ff', var: '--secondary' },
    { name: 'warning', value: '#ffaa00', var: '--warning' },
  ],
  chart: [
    { name: 'chart-1', value: '#22c55e', var: '--chart-1' },
    { name: 'chart-2', value: '#ef4444', var: '--chart-2' },
    { name: 'chart-3', value: '#00e5ff', var: '--chart-3' },
    { name: 'chart-4', value: '#ffaa00', var: '--chart-4' },
    { name: 'chart-5', value: '#a855f7', var: '--chart-5' },
  ],
};

function ColorSwatch({ name, value, cssVar }: { name: string; value: string; cssVar: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="w-12 h-12 border border-zinc-700 shrink-0 rounded"
        style={{ background: value }}
      />
      <div className="min-w-0">
        <p className="font-mono text-sm text-zinc-100">{name}</p>
        <p className="font-mono text-xs text-zinc-500 truncate">{cssVar}</p>
        <p className="font-mono text-xs text-zinc-500 truncate">{value}</p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-1 h-6 bg-gradient-to-b from-green-400 to-emerald-500" />
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="font-mono text-sm text-zinc-500 uppercase tracking-wider">
        {title}
      </h3>
      {children}
    </div>
  );
}

export default function DesignSystemPage() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-12 pb-20">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1 h-8 bg-gradient-to-b from-green-400 to-red-500" />
          <h1 className="text-3xl font-bold tracking-tight">Design System</h1>
        </div>
        <p className="font-mono text-sm text-zinc-500">
          // Developer reference for UI components and tokens
        </p>
      </div>

      {/* Color Tokens */}
      <Section title="Color Tokens">
        <div className="grid gap-8">
          <SubSection title="Core Colors">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {colorTokens.core.map((color) => (
                <ColorSwatch
                  key={color.name}
                  name={color.name}
                  value={color.value}
                  cssVar={color.var}
                />
              ))}
            </div>
          </SubSection>

          <SubSection title="Card Colors">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {colorTokens.card.map((color) => (
                <ColorSwatch
                  key={color.name}
                  name={color.name}
                  value={color.value}
                  cssVar={color.var}
                />
              ))}
            </div>
          </SubSection>

          <SubSection title="Accent Colors">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {colorTokens.accent.map((color) => (
                <ColorSwatch
                  key={color.name}
                  name={color.name}
                  value={color.value}
                  cssVar={color.var}
                />
              ))}
            </div>
          </SubSection>

          <SubSection title="Semantic Colors">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {colorTokens.semantic.map((color) => (
                <ColorSwatch
                  key={color.name}
                  name={color.name}
                  value={color.value}
                  cssVar={color.var}
                />
              ))}
            </div>
          </SubSection>

          <SubSection title="Chart Colors">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {colorTokens.chart.map((color) => (
                <ColorSwatch
                  key={color.name}
                  name={color.name}
                  value={color.value}
                  cssVar={color.var}
                />
              ))}
            </div>
          </SubSection>
        </div>
      </Section>

      {/* Typography */}
      <Section title="Typography">
        <div className="space-y-8">
          <SubSection title="Headings">
            <div className="space-y-4 p-6 bg-zinc-900/50 rounded-lg border border-zinc-800">
              <h1 className="text-4xl font-bold tracking-tight">Heading 1 - 4xl Bold</h1>
              <h2 className="text-3xl font-bold tracking-tight">Heading 2 - 3xl Bold</h2>
              <h3 className="text-2xl font-semibold">Heading 3 - 2xl Semibold</h3>
              <h4 className="text-xl font-semibold">Heading 4 - xl Semibold</h4>
              <h5 className="text-lg font-medium">Heading 5 - lg Medium</h5>
              <h6 className="text-base font-medium">Heading 6 - base Medium</h6>
            </div>
          </SubSection>

          <SubSection title="Body Text">
            <div className="space-y-4 p-6 bg-zinc-900/50 rounded-lg border border-zinc-800">
              <p className="text-base">
                Body text (base) - The quick brown fox jumps over the lazy dog.
              </p>
              <p className="text-sm">
                Small text (sm) - The quick brown fox jumps over the lazy dog.
              </p>
              <p className="text-xs">
                Extra small text (xs) - The quick brown fox jumps over the lazy dog.
              </p>
              <p className="text-sm text-zinc-500">
                Muted text - The quick brown fox jumps over the lazy dog.
              </p>
            </div>
          </SubSection>

          <SubSection title="Monospace">
            <div className="space-y-4 p-6 bg-zinc-900/50 rounded-lg border border-zinc-800">
              <p className="font-mono text-base">
                Mono text (base) - const value = 42;
              </p>
              <p className="font-mono text-sm">
                Mono text (sm) - function hello() {"{ return 'world'; }"}
              </p>
              <p className="font-mono text-sm text-green-400">
                Terminal text - SYSTEM_STATUS: ONLINE
              </p>
            </div>
          </SubSection>
        </div>
      </Section>

      {/* Buttons */}
      <Section title="Buttons">
        <div className="space-y-8">
          <SubSection title="Button Variants">
            <div className="flex flex-wrap gap-4 p-6 bg-zinc-900/50 rounded-lg border border-zinc-800">
              <Button variant="default">Default</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="link">Link</Button>
              <Button variant="destructive">Destructive</Button>
            </div>
          </SubSection>

          <SubSection title="Button Sizes">
            <div className="flex flex-wrap items-center gap-4 p-6 bg-zinc-900/50 rounded-lg border border-zinc-800">
              <Button size="sm">Small</Button>
              <Button size="default">Default</Button>
              <Button size="lg">Large</Button>
              <Button size="icon">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </Button>
            </div>
          </SubSection>

          <SubSection title="Button States">
            <div className="flex flex-wrap gap-4 p-6 bg-zinc-900/50 rounded-lg border border-zinc-800">
              <Button>Enabled</Button>
              <Button disabled>Disabled</Button>
            </div>
          </SubSection>
        </div>
      </Section>

      {/* Cards */}
      <Section title="Cards">
        <div className="grid gap-8">
          <SubSection title="Basic Card">
            <div className="max-w-md">
              <Card>
                <CardHeader>
                  <CardTitle>Card Title</CardTitle>
                  <CardDescription>Card description with muted text style.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p>Card content goes here. This is the main body of the card.</p>
                </CardContent>
                <CardFooter>
                  <Button variant="outline" size="sm">
                    Cancel
                  </Button>
                  <Button size="sm" className="ml-2">
                    Submit
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </SubSection>

          <SubSection title="Stat Cards">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="p-4">
                <p className="font-mono text-xs text-zinc-500 mb-1">TOTAL_VALUE</p>
                <p className="text-2xl font-bold text-green-400">$1,234.56</p>
              </Card>
              <Card className="p-4">
                <p className="font-mono text-xs text-zinc-500 mb-1">24H_CHANGE</p>
                <p className="text-2xl font-bold text-emerald-500">+12.5%</p>
              </Card>
              <Card className="p-4">
                <p className="font-mono text-xs text-zinc-500 mb-1">POSITIONS</p>
                <p className="text-2xl font-bold">42</p>
              </Card>
            </div>
          </SubSection>
        </div>
      </Section>

      {/* Badges */}
      <Section title="Badges">
        <div className="flex flex-wrap gap-4 p-6 bg-zinc-900/50 rounded-lg border border-zinc-800">
          <Badge variant="default">Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="destructive">Destructive</Badge>
        </div>
      </Section>

      {/* Inputs */}
      <Section title="Inputs">
        <div className="space-y-8">
          <SubSection title="Basic Input">
            <div className="max-w-md space-y-4 p-6 bg-zinc-900/50 rounded-lg border border-zinc-800">
              <div className="space-y-2">
                <Label htmlFor="basic-input">Label</Label>
                <Input id="basic-input" placeholder="Enter text..." />
              </div>
            </div>
          </SubSection>

          <SubSection title="Input States">
            <div className="max-w-md space-y-4 p-6 bg-zinc-900/50 rounded-lg border border-zinc-800">
              <div className="space-y-2">
                <Label htmlFor="placeholder-input">With Placeholder</Label>
                <Input id="placeholder-input" placeholder="Placeholder text" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="value-input">With Value</Label>
                <Input id="value-input" defaultValue="Input value" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="disabled-input">Disabled</Label>
                <Input id="disabled-input" placeholder="Disabled input" disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="error-input" className="text-red-500">
                  With Error
                </Label>
                <Input
                  id="error-input"
                  placeholder="Error state"
                  className="border-red-500 focus-visible:ring-red-500"
                />
                <p className="text-xs text-red-500">This field is required.</p>
              </div>
            </div>
          </SubSection>
        </div>
      </Section>

      {/* Skeleton */}
      <Section title="Skeleton / Loading States">
        <div className="space-y-8">
          <SubSection title="Basic Skeletons">
            <div className="space-y-4 p-6 bg-zinc-900/50 rounded-lg border border-zinc-800">
              <Skeleton className="h-4 w-[250px]" />
              <Skeleton className="h-4 w-[200px]" />
              <Skeleton className="h-4 w-[150px]" />
            </div>
          </SubSection>

          <SubSection title="Card Skeleton">
            <div className="max-w-md p-6 bg-zinc-900/50 rounded-lg border border-zinc-800">
              <div className="space-y-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-[250px]" />
                  <Skeleton className="h-4 w-[200px]" />
                </div>
              </div>
            </div>
          </SubSection>
        </div>
      </Section>

      {/* Tabs */}
      <Section title="Tabs">
        <div className="max-w-md p-6 bg-zinc-900/50 rounded-lg border border-zinc-800">
          <Tabs defaultValue="tab1">
            <TabsList>
              <TabsTrigger value="tab1">Overview</TabsTrigger>
              <TabsTrigger value="tab2">Markets</TabsTrigger>
              <TabsTrigger value="tab3">Activity</TabsTrigger>
            </TabsList>
            <TabsContent value="tab1" className="p-4">
              <p className="text-sm text-zinc-500">
                Overview tab content. This is the first tab.
              </p>
            </TabsContent>
            <TabsContent value="tab2" className="p-4">
              <p className="text-sm text-zinc-500">
                Markets tab content. This is the second tab.
              </p>
            </TabsContent>
            <TabsContent value="tab3" className="p-4">
              <p className="text-sm text-zinc-500">
                Activity tab content. This is the third tab.
              </p>
            </TabsContent>
          </Tabs>
        </div>
      </Section>

      {/* Data Table */}
      <Section title="Data Table">
        <div className="bg-zinc-900/50 rounded-lg border border-zinc-800 overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-zinc-800">
              <tr>
                <th className="text-left p-4 font-medium text-zinc-400">Market</th>
                <th className="text-right p-4 font-medium text-zinc-400">Price</th>
                <th className="text-right p-4 font-medium text-zinc-400">Volume</th>
                <th className="text-right p-4 font-medium text-zinc-400">Change</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                <td className="p-4 font-medium">Will X happen?</td>
                <td className="p-4 text-right font-mono">$0.75</td>
                <td className="p-4 text-right font-mono text-zinc-500">$1.2M</td>
                <td className="p-4 text-right font-mono text-green-500">+5.2%</td>
              </tr>
              <tr className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                <td className="p-4 font-medium">Will Y occur?</td>
                <td className="p-4 text-right font-mono">$0.32</td>
                <td className="p-4 text-right font-mono text-zinc-500">$890K</td>
                <td className="p-4 text-right font-mono text-red-500">-2.1%</td>
              </tr>
              <tr className="hover:bg-zinc-800/30">
                <td className="p-4 font-medium">Will Z be true?</td>
                <td className="p-4 text-right font-mono">$0.88</td>
                <td className="p-4 text-right font-mono text-zinc-500">$2.4M</td>
                <td className="p-4 text-right font-mono text-green-500">+12.8%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
