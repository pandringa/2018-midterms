let PREFIXES = /((Dr|Mr|Mrs|Ms|Judge|Honorable|Hon)\.?|Miss)[\s$]/im;
let SUFFIXES = /((Sr|Jr|III|IV|V|VI|VII|VIII|IX|X|P\.?h\.?d|J\.?D|M\.?D)\.?)[\s$]/im;
let NICKNAME = /\s[\('"](.*)[\)'"]\s?/im;

// Fix Prefix not matching end of line

function titleCase(words){
  if(typeof words != 'string') return words;
  return words.split(' ').map(w => {
    return w.substring(0,1).toUpperCase() + w.substring(1).toLowerCase();
  }).join(' ');
}

module.exports = (input) => {
  var first, middle, last, prefix, suffix, nickname, prefix_match, suffix_match, nickname_match;
  
  if(input.indexOf(', ') > -1){
    [last, first] = input.split(', ')
  }else{
    let a = input.split(' ');
    last = a.splice(a.length-1, 1)[0];
    first = a.join(' ');
  }
  
  if(prefix_match = first.match(PREFIXES)){
    prefix = prefix_match[1];
    let i = first.indexOf(prefix_match[0]);
    first = first.substring(0,i) + first.substring(i+prefix_match[0].length);
  } 
  if(suffix_match = first.match(SUFFIXES)){
    suffix = suffix_match[1];
    let i = first.indexOf(suffix_match[0]);
    first = first.substring(0, i) + first.substring(i + suffix_match[0].length);
  }
  if(nickname_match = first.match(NICKNAME)){
    nickname = nickname_match[1];
    let i = first.indexOf(nickname_match[0]);
    first = first.substring(0, i) + first.substring(i + nickname_match[0].length + 2);
  }
  if(first.indexOf(' ') > -1){
    var names = first.split(' ');
    first = names.splice(0,1)[0];
    middle = names.join(' ');
  }

  return {
    prefix: titleCase(prefix),
    first: titleCase(first),
    middle: titleCase(middle),
    last: titleCase(last),
    suffix: titleCase(suffix),
    nickname: nickname
  }
}