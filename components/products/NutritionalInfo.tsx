'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'

export interface NutritionalInfo {
  id: string
  productId: string
  servingSize: string
  calories: number
  totalFat: string
  sodium: string
  totalCarbs: string
  protein: string
  allergens: string | null
  createdAt: Date
  updatedAt: Date
}

interface NutritionalInfoProps {
  nutritionalInfo: NutritionalInfo
  ingredients?: string[] | null
}

export function NutritionalInfo({ nutritionalInfo, ingredients }: NutritionalInfoProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Nutritional Information</CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible defaultValue="nutrition-facts">
          {/* Nutrition Facts */}
          <AccordionItem value="nutrition-facts">
            <AccordionTrigger className="text-base font-semibold">
              Nutrition Facts
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3">
                {/* Serving Size */}
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="font-medium text-sm">Serving Size</span>
                  <span className="text-sm text-muted-foreground">
                    {nutritionalInfo.servingSize}
                  </span>
                </div>

                {/* Calories */}
                <div className="flex justify-between items-center py-2 border-b-2 border-border">
                  <span className="font-bold text-base">Calories</span>
                  <span className="font-bold text-lg">
                    {nutritionalInfo.calories}
                  </span>
                </div>

                {/* Macronutrients */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-1.5 border-b border-border">
                    <span className="font-medium">Total Fat</span>
                    <span className="text-muted-foreground">
                      {nutritionalInfo.totalFat}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border">
                    <span className="font-medium">Sodium</span>
                    <span className="text-muted-foreground">
                      {nutritionalInfo.sodium}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border">
                    <span className="font-medium">Total Carbohydrates</span>
                    <span className="text-muted-foreground">
                      {nutritionalInfo.totalCarbs}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border">
                    <span className="font-medium">Protein</span>
                    <span className="text-muted-foreground">
                      {nutritionalInfo.protein}
                    </span>
                  </div>
                </div>

                {/* Allergens */}
                {nutritionalInfo.allergens && (
                  <div className="pt-3 mt-3 border-t-2 border-border">
                    <div className="flex items-start gap-2">
                      <Badge variant="destructive" className="mt-0.5">
                        Allergens
                      </Badge>
                      <p className="text-sm text-muted-foreground flex-1">
                        {nutritionalInfo.allergens}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Ingredients */}
          {ingredients && ingredients.length > 0 && (
            <AccordionItem value="ingredients">
              <AccordionTrigger className="text-base font-semibold">
                Ingredients
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {ingredients.join(', ')}
                </p>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      </CardContent>
    </Card>
  )
}
