import type { HowItWorksBlock as HowItWorksBlockType } from '@/lib/fundraiser-page-config'

type Props = {
  block: HowItWorksBlockType
}

const defaultSteps = [
  {
    title: 'Choose Your Salsa',
    description: 'Browse our selection of handcrafted salsas and bundles.',
  },
  {
    title: 'Place Your Order',
    description: 'Order online and your purchase supports our fundraiser.',
  },
  {
    title: 'We Earn Commission',
    description: 'A portion of every sale goes directly to our cause.',
  },
]

export function HowItWorksBlock({ block }: Props) {
  const steps = block.steps?.length ? block.steps : defaultSteps

  return (
    <section className="px-4 py-12">
      <div className="mx-auto max-w-4xl">
        <h2 className="mb-8 text-center font-serif text-2xl font-bold text-gray-900">
          How It Works
        </h2>
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          {steps.map((step, index) => (
            <div key={index} className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-salsa-100 font-bold text-salsa-600">
                {index + 1}
              </div>
              <h3 className="mb-2 font-semibold text-gray-900">{step.title}</h3>
              <p className="text-sm text-gray-600">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
