# Picopico Sequencer
====================
__picopico sequencer__ is a web-based and Flash-free music sequencer.
It employs the brand new __WebAudio API__ for playing the sounds(now writing...)

The Japanese term "Picopico" generally refers to the sounds produced by the traditional video game consoles such as the Family Computer and
Super Family Computer(SFC), also known as SNES in English-speaking countries. So the name "Picopico Sequencer" suggests that the program can only
produce such 

Notice that the program can't be run out-of-the-box because it lacks some dependencies by default. So you must first explicitly install extra
dependent files.
See the __How to run the program__ section for more details.

## How to run the program
As mentioned above, you can't run the program out of the box. To run the program, you need to have the __dojo__ library in proper directory.
There are two ways to do that. One is to download __dojo__ files and move the files to the proper directory by hand.
And the other is to simply use the `git submodule` commands. In detail you must first execute `git submodule init` on the root directory of the
project and then just type `git submodule update`.

## Dependent Open Source Projects
  * [dojo] for the great graphical user interfaces
  * [treehugger] for the AST of MML parsing
  * [jasmine] for testing framework

## Links to dependent projects
I'd like to say a big "Thank you" to all developers and contributors of these projects!

[dojo]: http://dojotoolkit.org/
[treehugger]: http://github.com/ajaxorg/treehugger
[jasmine]: http://pivotal.github.com/jasmine/

## License
The program is published under the MIT license. The text of MIT license is reprodued below.
------------------
Permission is hereby granted, free of charge, to any person obtaining a copy of this
software and associated documentation files (the "Software"), to deal in the Software
without restriction, including without limitation the rights to use, copy, modify,
merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be included in all copies
or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
