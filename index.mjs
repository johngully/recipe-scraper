import * as dotenv from "dotenv";
import { readFile } from "fs/promises"
import * as cheerio from "cheerio";
import { Configuration, OpenAIApi } from "openai";
import { start } from "repl";

// Get environment variables
dotenv.config();
const organization = process.env.OPENAI_ORG_ID;
const apiKey = process.env.OPENAI_API_KEY;

// Mock stubs for testing purposes
// const mockFile = "penne-with-vodka-sauce";
// const mockFile = "chocolate-cake";
const mockFile = "tomato-basil-soup";
// const mockFile = "tomato-basil-soup.scraped";
const mockUrl = "https://www.food.com/recipe/la-madeleines-tomato-basil-soup-5368";
const mockSelector = "#recipe";

const Recipe = {
  ingredients: [],
  instructions: [],
  notes: [],
  preparationTime: "",
  cookingTime: "",
  servingSize: ""
}

const textToParse = await getRecipeText(mockUrl, mockSelector);
const recipe = await getRecipeFromText(textToParse);
console.log("Recipe:", recipe);

async function getRecipeTextMock(url) {
  return await readFile(`./recipe.${mockFile}.txt`, "utf-8");
}

async function getRecipeText(url, selector) {
  const response = await fetch(url);
  const body = await response.text();
  const $ = cheerio.load(body);
  let content = $(selector).text();
  if (!content) {
    throw new Error(`The selector "${selector}" could not find any text.`);
  }
  // replace extraneous new lines from response
  content = content.replace(/ +(?= )/g,'');
  content = content.replace(/( \n|\n )/g,'');
  content = content.replace(/(\r\n|\r|\n){2,}/g, '$1\n');
  return content;
}

async function getRecipeFromText(text) {
  // const recipeText = await parseRecipeUsingOpenAIMock(text);
  const recipeText = await parseRecipeUsingOpenAI(text);
  const recipe = textToRecipe(recipeText);
  return recipe;
}

async function parseRecipeUsingOpenAIMock(text) {
  return await readFile(`./recipeResponse.${mockFile}.txt`, "utf-8");
}

async function parseRecipeUsingOpenAI(text) {
  // Setup OpenAI
  const configuration = new Configuration({ organization, apiKey });
  const openai = new OpenAIApi(configuration);
  const completionRequest = {
    "model": `text-davinci-003`,
    "prompt": `From the following receipe, list the ingredients including quantities and instructions for preparation? If they are found in the recipe, include additional notes, preparation time, cooking time, total time, and serving size.
    
    ${text}
    `,
    "max_tokens": 2048,
    "temperature": 0,
    "top_p": 1,
    "n": 1,
    "stream": false,
    "logprobs": null,
    // "stop": "\n"
  };

  // Use the OpenAI completion request to parse the text
  // Get the first response and return it
  const response = await openai.createCompletion(completionRequest);
  const firstResponseText = response.data.choices[0]?.text
  return firstResponseText;
}

function textToRecipe(text) {
  // let position = 0;
  const newSectionKey = "\n\n";
  const newLineKey = "\n";
  const ingredientsKey = "Ingredients:\n".toLowerCase();
  const instructionsKey = "Instructions:\n".toLowerCase();
  const preparationTimeKey = ["Preparation Time: ".toLowerCase(), "Prep Time: ".toLowerCase()];
  const cookingTimeKey = ["Cooking Time: ".toLowerCase(), "Cook Time: ".toLowerCase()];
  const totalTimeKey = "Total Time: ".toLowerCase();
  const servingSizeKey = "Serving Size: ".toLowerCase();
  
  

  // const lowerCaseText = text.toLowerCase()+newLineKey;
  // const ingredientsPosition = lowerCaseText.indexOf(ingredientsKey, position) + ingredientsKey.length;
  // position = lowerCaseText.indexOf(newSectionKey, ingredientsPosition);
  // const ingredients = text.substr(ingredientsPosition, position-ingredientsPosition).split(newLineKey);

  // const instructionsPosition = lowerCaseText.indexOf(instructionsKey, position) + instructionsKey.length;
  // position = lowerCaseText.indexOf(newSectionKey, instructionsPosition);
  // const instructions = text.substr(instructionsPosition, position-instructionsPosition).split(newLineKey);

  const ingredients = getTextLine(text, 0, ingredientsKey, newSectionKey);
  const instructions = getTextLine(text, ingredients.endPosition, instructionsKey, newSectionKey);
  const preparationTime = getTextLine(text, instructions.endPosition, preparationTimeKey);
  const cookingTime = getTextLine(text, preparationTime.endPosition, cookingTimeKey);
  const totalTime = getTextLine(text, cookingTime.endPosition, totalTimeKey);
  const servingSize = getTextLine(text, totalTime.endPosition, servingSizeKey);
  
  const recipe = { ...Recipe };
  recipe.ingredients = ingredients.text.split(newLineKey);
  recipe.instructions = instructions.text.split(newLineKey);
  recipe.preparationTime = preparationTime.text;
  recipe.cookingTime = cookingTime.text;
  recipe.totalTime = totalTime.text;
  recipe.servingSize = servingSize.text;
  recipe.originalText = text;
  return recipe;
}

function getTextLine(originalText, startPosition, startKeys, endKey = "\n") {
  let keys = typeof startKeys === "string" ? [ startKeys ] : [...startKeys];
  let endPosition = startPosition;
  let text = "";
  const lowerCaseText = originalText.toLowerCase() + endKey;

  for (const startKey of keys) {
    let foundPosition = lowerCaseText.indexOf(startKey, startPosition);
    if (foundPosition > -1) {
      foundPosition += startKey.length;
      endPosition = lowerCaseText.indexOf(endKey, foundPosition);
      text = originalText.substr(foundPosition, endPosition-foundPosition);  
      break;
    }
  }

  return { text, endPosition };  
}