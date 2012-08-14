# Picopico Sequencer
====================
__picopico sequencer__ is a web-based and Flash-free music sequencer.
It employs the brand new __WebAudio API__ for playing the sounds. So as of now it's very likely that Picopico Sequencer only works properly on
Google Chrome.

The Japanese term "Picopico" generally refers to the sounds produced by the traditional video game consoles such as the Family Computer and
Super Family Computer(SFC), which are also known as NES and SNES in English-speaking countries. So the name "Picopico Sequencer" suggests that
the program can only produce such eh...(I don't know how it can be described in English) primitive sounds.

Notice that the program can't be run out-of-the-box because it lacks some dependencies by default. So you must first explicitly install extra
dependent files.
See the __How to run the program__ section for more details.

## Features
  * MML editing
  * A visual representation in piano roll
  * Total of 6 types of "primitive" sound waves
  * The potential of generating any type of sound
  * MML editing with GUI(not yet implemented)

## How to run the program
As mentioned above, you can't run the program out of the box. To run the program, you need to have the __dojo__ library in the proper directory.
There are two ways to do that. One is to download __dojo__ files and move the files to the proper directory by yourself.
And the other is to simply use the `git submodule` commands. In detail you must first execute `git submodule init` on the root directory of the
project and then just type `git submodule update` or just use `git submodule update --init --recursive`. Then it will collect all modules the program needs and will immediately take you to the tour of
the program.

## Just before the release...
At the very end of development, you must build the program to reduce the number of HTTPRequests and the program size. To do that, you must just
invoke the build.sh at the root directory of the project.

## Dependent Open Source Projects
  * [dojo] for the great graphical user interfaces
  * [treehugger] for the AST of MML parsing
  * [jasmine] for testing framework

## Links to dependency projects
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
