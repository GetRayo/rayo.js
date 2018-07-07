#!/bin/sh

rm -rf node_modules

for dir in ./packages/*
do
  printf "\n⚡️ Working %s\n" "$dir"
  cd $dir
  rm -rf node_modules
  npm i -q -s
  printf "\033[1A"
  npm-check -u
  cd ../..
done

printf "\n⚡️ Working ./\n"
npm i -q -s
printf "\033[1A"
npm-check -u
